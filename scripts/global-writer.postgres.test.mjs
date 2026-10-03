import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Only creates its own ephemeral PostgreSQL; never accepts a host database URL.
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = path.join(repository, "apps/api/prisma/migrations");
const container = `fac-012ac-postgres-${randomUUID()}`;
const image = "postgres:18.1-alpine";
const project = randomUUID();
const runs = [randomUUID(), randomUUID()];
let created = false;
let exclusionSql = "";

function sql(statement) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      { timeout: 20_000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr.trim() || "Isolated PostgreSQL command failed"));
        else resolve(stdout.trim());
      },
    );
    child.stdin.end(statement);
  });
}

function insert(run, id = randomUUID()) {
  return `INSERT INTO attempts(id,run_id,worker_id,sequence,fencing_token,lease_expires_at)
    VALUES ('${id}','${run}','${randomUUID()}',1,1,NOW()-INTERVAL '1 minute');`;
}

before(async () => {
  execFileSync("docker", ["image", "inspect", image], { stdio: "ignore" });
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--network",
      "none",
      "--memory",
      "512m",
      "--cpus",
      "1",
      "--tmpfs",
      "/var/lib/postgresql:rw,size=256m",
      "-e",
      "POSTGRES_PASSWORD=synthetic-fixture-only",
      image,
    ],
    { stdio: "ignore", timeout: 20_000 },
  );
  created = true;
  let ready = false;
  for (let count = 0; count < 40; count++) {
    try {
      await sql("SELECT 1;");
      ready = true;
      break;
    } catch {
      await delay(500);
    }
  }
  assert.ok(ready, "isolated PostgreSQL must start");
  for (const directory of (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const statement = await readFile(
      path.join(migrations, directory.name, "migration.sql"),
      "utf8",
    );
    await sql(statement);
    if (directory.name.endsWith("fac_012ac_global_writer")) exclusionSql = statement;
  }
  assert.ok(exclusionSql, "must apply the actual versioned exclusion migration");
  await sql(
    `INSERT INTO projects(id,name,repo_url,base_ref,updated_at) VALUES ('${project}','synthetic','https://example.invalid/synthetic','main',NOW());`,
  );
  for (const run of runs) {
    const ticket = randomUUID();
    await sql(`INSERT INTO tickets(id,project_id,title,objective,acceptance_criteria,updated_at) VALUES ('${ticket}','${project}','synthetic','synthetic','["synthetic"]',NOW());
      INSERT INTO runs(id,ticket_id,dispatch_event_id,updated_at) VALUES ('${run}','${ticket}','${randomUUID()}',NOW());`);
  }
});

after(() => {
  if (created)
    execFileSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 20_000 });
});
beforeEach(async () => {
  await sql("TRUNCATE checkpoints, attempts;");
});

test("actual migration admits only one concurrent writer across different runs and workers", async () => {
  const results = await Promise.allSettled(
    runs.map((run) => sql(`BEGIN; ${insert(run)} SELECT pg_sleep(0.35); COMMIT;`)),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.match(rejected.reason.message, /attempts_single_unconfirmed_writer/);
  assert.equal(await sql("SELECT count(*) FROM attempts WHERE stopped_confirmed=false;"), "1");
});

test("expired lease and FAILED status cannot release global exclusion; proven stop can", async () => {
  const first = randomUUID();
  await sql(insert(runs[0], first));
  await sql(`UPDATE attempts SET status='FAILED' WHERE id='${first}';`);
  await assert.rejects(sql(insert(runs[1])), /attempts_single_unconfirmed_writer/);
  await sql(`UPDATE attempts SET stopped_confirmed=true WHERE id='${first}';`);
  await sql(insert(runs[1]));
  assert.equal(await sql("SELECT count(*) FROM attempts WHERE stopped_confirmed=false;"), "1");
  await assert.rejects(
    sql(`UPDATE attempts SET stopped_confirmed=false WHERE id='${first}';`),
    /attempts_single_unconfirmed_writer/,
  );
});

test("migration refuses preexisting multiple unresolved writers without changing their evidence", async () => {
  await sql("DROP INDEX attempts_single_unconfirmed_writer;");
  await sql(insert(runs[0]));
  await sql(insert(runs[1]));
  await assert.rejects(sql(exclusionSql), /attempts_single_unconfirmed_writer/);
  assert.equal(await sql("SELECT count(*) FROM attempts WHERE stopped_confirmed=false;"), "2");
  // Synthetic fixture reset only; real migration deliberately offers no auto-repair.
  await sql("TRUNCATE checkpoints, attempts;");
  await sql(exclusionSql);
});

test("operation readiness queries the real valid exclusion definition rather than an index name alone", async () => {
  const source = await readFile(
    path.join(repository, "apps/api/src/orchestration/global-writer-guard.ts"),
    "utf8",
  );
  const query = source.match(/SELECT EXISTS[\s\S]+?AS installed/)?.[0];
  assert.ok(query, "use the actual operation query");
  assert.equal(await sql(query), "t");
  await sql(
    "DROP INDEX attempts_single_unconfirmed_writer; CREATE INDEX attempts_single_unconfirmed_writer ON attempts(run_id);",
  );
  assert.equal(await sql(query), "f");
  await sql("DROP INDEX attempts_single_unconfirmed_writer;");
  await sql(exclusionSql);
});

test("project event cursor and invalidations roll back with the actual ticket transaction", async () => {
  const before = await sql(
    `SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`,
  );
  await sql(
    `BEGIN; UPDATE tickets SET title='synthetic rollback' WHERE id=(SELECT ticket_id FROM runs WHERE id='${runs[0]}'); ROLLBACK;`,
  );
  assert.equal(
    await sql(`SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`),
    before,
  );
  assert.equal(
    await sql(`SELECT max(sequence) FROM project_events WHERE project_id='${project}';`),
    before,
  );
});

test("same-project concurrent transactions persist contiguous ordered events", async () => {
  const before = BigInt(
    await sql(`SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`),
  );
  await Promise.all(
    runs.map((run) =>
      sql(
        `BEGIN; UPDATE tickets SET title='${randomUUID()}' WHERE id=(SELECT ticket_id FROM runs WHERE id='${run}'); SELECT pg_sleep(0.2); COMMIT;`,
      ),
    ),
  );
  assert.equal(
    await sql(`SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`),
    (before + 2n).toString(),
  );
  assert.equal(
    await sql(
      `SELECT string_agg(sequence::text,',' ORDER BY sequence) FROM project_events WHERE project_id='${project}' AND sequence>${before};`,
    ),
    `${before + 1n},${before + 2n}`,
  );
});

test("lease renewals do not produce project event churn but stop/status changes do", async () => {
  const id = randomUUID();
  await sql(insert(runs[0], id));
  const before = BigInt(
    await sql(`SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`),
  );
  await sql(`UPDATE attempts SET lease_expires_at=NOW()+INTERVAL '1 minute' WHERE id='${id}';`);
  assert.equal(
    await sql(`SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`),
    before.toString(),
  );
  await sql(`UPDATE attempts SET status='FAILED' WHERE id='${id}';`);
  await sql(`UPDATE attempts SET stopped_confirmed=true WHERE id='${id}';`);
  assert.equal(
    await sql(`SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`),
    (before + 2n).toString(),
  );
});

test("encrypted backup restores a real custom PostgreSQL dump with project events and exclusion intact", async () => {
  const { createEvidenceBackup, restoreEvidenceBackup, verifyEvidenceBackup } = await import(
    "../packages/runtime/dist/evidence-backup.js"
  );
  const root = await mkdtemp(path.join(tmpdir(), "fac-012af-database-backup-"));
  try {
    const snapshots = path.join(root, "snapshots");
    const journal = path.join(root, "journal");
    await mkdir(snapshots, { mode: 0o700 });
    await mkdir(journal, { mode: 0o700 });
    const dump = execFileSync(
      "docker",
      ["exec", container, "pg_dump", "-U", "postgres", "-Fc", "postgres"],
      { maxBuffer: 64 * 1024 * 1024, timeout: 20_000 },
    );
    const databaseDump = path.join(root, "database.dump");
    await writeFile(databaseDump, dump, { mode: 0o600 });
    const keyFile = path.join(root, "key");
    await writeFile(keyFile, randomBytes(32), { mode: 0o600 });
    const output = path.join(root, "archive.lfb");
    const expected = await sql(
      `SELECT count(*) FROM project_events WHERE project_id='${project}'; SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`,
    );
    await createEvidenceBackup({
      databaseDump,
      snapshots,
      journal,
      keyFile,
      output,
      servicesStopped: true,
    });
    assert.equal((await verifyEvidenceBackup({ archive: output, keyFile })).files, 1);
    const destination = path.join(root, "restored");
    await restoreEvidenceBackup({
      archive: output,
      keyFile,
      destination,
      isolatedDestination: true,
    });
    const restoredDump = await readFile(path.join(destination, "database.dump"));
    assert.deepEqual(restoredDump, dump);
    await sql("CREATE DATABASE fac_012af_restored;");
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        "fac_012af_restored",
        "--exit-on-error",
      ],
      { input: restoredDump, timeout: 20_000, maxBuffer: 1024 * 1024 },
    );
    const result = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "fac_012af_restored",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      {
        input: `SELECT count(*) FROM project_events WHERE project_id='${project}'; SELECT sequence FROM project_event_cursors WHERE project_id='${project}';`,
        timeout: 20_000,
      },
    )
      .toString()
      .trim();
    assert.equal(result, expected);
    const guardSource = await readFile(
      path.join(repository, "apps/api/src/orchestration/global-writer-guard.ts"),
      "utf8",
    );
    const query = guardSource.match(/SELECT EXISTS[\s\S]+?AS installed/)?.[0];
    assert.equal(
      execFileSync(
        "docker",
        ["exec", "-i", container, "psql", "-U", "postgres", "-d", "fac_012af_restored", "-At"],
        { input: query, timeout: 20_000 },
      )
        .toString()
        .trim(),
      "t",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("factory scheduling defaults paused and versions cannot be clobbered", async () => {
  assert.equal(await sql("SELECT paused FROM factory_operations WHERE id='factory';"), "t");
  const version = await sql("SELECT version FROM factory_operations WHERE id='factory';");
  await sql(
    `UPDATE factory_operations SET paused=false, version=version+1 WHERE id='factory' AND version=${version};`,
  );
  assert.equal(await sql("SELECT paused FROM factory_operations WHERE id='factory';"), "f");
  await sql(
    `UPDATE factory_operations SET paused=true, version=version+1 WHERE id='factory' AND version=${version};`,
  );
  assert.equal(await sql("SELECT paused FROM factory_operations WHERE id='factory';"), "f");
  await sql("UPDATE factory_operations SET paused=true,version=version+1 WHERE id='factory';");
});

test("claim's shared scheduling lock orders administrative pause after admitted writer commit", async () => {
  await sql("UPDATE factory_operations SET paused=false,version=version+1 WHERE id='factory';");
  const order = [];
  const claim = sql(
    `/* fac-012ag-claim-fixture */ BEGIN; SELECT paused FROM factory_operations WHERE id='factory' FOR SHARE; SELECT pg_sleep(2) /* fac-012ag-claim-fixture */; ${insert(runs[0])} COMMIT;`,
  ).then(() => order.push("claim"));
  let waiting = false;
  for (let count = 0; count < 15; count++) {
    if (
      (await sql(
        "SELECT count(*) FROM pg_stat_activity WHERE query LIKE 'SELECT pg_sleep(2)%fac-012ag-claim-fixture%' AND wait_event='PgSleep';",
      )) === "1"
    ) {
      waiting = true;
      break;
    }
    await delay(20);
  }
  assert.ok(waiting, "actual claim transaction must hold shared lock before pause");
  const pause = sql(
    "UPDATE factory_operations SET paused=true,version=version+1 WHERE id='factory' /* fac-012ag-pause-fixture */;",
  ).then(() => order.push("pause"));
  let pauseBlocked = false;
  for (let count = 0; count < 10; count++) {
    if (
      (await sql(
        "SELECT count(*) FROM pg_stat_activity WHERE query LIKE 'UPDATE factory_operations%fac-012ag-pause-fixture%' AND wait_event_type='Lock';",
      )) === "1"
    ) {
      pauseBlocked = true;
      break;
    }
    await delay(20);
  }
  assert.ok(pauseBlocked, "pause must actually wait for claim's row lock");
  await Promise.all([claim, pause]);
  assert.equal(order.length, 2);
  assert.equal(await sql("SELECT paused FROM factory_operations WHERE id='factory';"), "t");
  assert.equal(await sql("SELECT count(*) FROM attempts WHERE stopped_confirmed=false;"), "1");
});
