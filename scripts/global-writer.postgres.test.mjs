import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
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
