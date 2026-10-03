import { execFileSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  createEvidenceBackup,
  restoreEvidenceBackup,
  verifyEvidenceBackup,
} from "./evidence-backup";
import { SnapshotManager } from "./snapshot-manager";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "fac-012af-backup-"));
  roots.push(root);
  const snapshots = path.join(root, "snapshots");
  const journal = path.join(root, "journal");
  await mkdir(snapshots, { mode: 0o700 });
  await mkdir(journal, { mode: 0o700 });
  const snapshotId = randomUUID();
  const folder = path.join(snapshots, snapshotId);
  await mkdir(path.join(folder, "untracked"), { recursive: true, mode: 0o700 });
  const patch = Buffer.from("synthetic patch bytes");
  const fresh = Buffer.from([0, 1, 2, 255]);
  const core = {
    schemaVersion: 1,
    snapshotId,
    baseRevision: "a".repeat(40),
    headRevision: "a".repeat(40),
    patchBytes: patch.length,
    patchSha256: hash(patch),
    untracked: [{ path: "new.bin", sizeBytes: fresh.length, mode: 0o600, sha256: hash(fresh) }],
    totalArtifactBytes: patch.length + fresh.length,
    createdAt: "2026-10-03T20:00:00Z",
  };
  await writeFile(
    path.join(folder, "manifest.json"),
    JSON.stringify({ ...core, manifestHash: hash(Buffer.from(JSON.stringify(core))) }),
    { mode: 0o600 },
  );
  await writeFile(path.join(folder, "tracked.patch"), patch, { mode: 0o600 });
  await writeFile(path.join(folder, "untracked/new.bin"), fresh, { mode: 0o600 });
  const eventId = randomUUID();
  const journalCore = {
    schemaVersion: 1,
    eventId,
    jobDigest: "b".repeat(64),
    intent: { synthetic: true },
  };
  await writeFile(
    path.join(journal, `${eventId}.json`),
    JSON.stringify({ ...journalCore, entryHash: hash(Buffer.from(JSON.stringify(journalCore))) }),
    { mode: 0o600 },
  );
  const databaseDump = path.join(root, "input.dump");
  await writeFile(databaseDump, "PGDMP-synthetic-custom-format-header", { mode: 0o600 });
  const keyFile = path.join(root, "key");
  await writeFile(keyFile, randomBytes(32), { mode: 0o600 });
  const output = path.join(root, "archive.lfb");
  const input = { databaseDump, snapshots, journal, keyFile, output, servicesStopped: true };
  return { root, input, folder, snapshotId, eventId, patch, fresh };
}
it("encrypts and verifies all bytes then restores to a private new staging directory", async () => {
  const f = await fixture();
  const result = await createEvidenceBackup(f.input);
  expect(result.files).toBe(5);
  const encrypted = await readFile(f.input.output);
  expect(encrypted.includes(f.patch)).toBe(false);
  expect(encrypted.includes(await readFile(f.input.keyFile))).toBe(false);
  expect((await lstat(f.input.output)).mode & 0o777).toBe(0o600);
  expect(
    (await verifyEvidenceBackup({ archive: f.input.output, keyFile: f.input.keyFile })).files,
  ).toBe(5);
  const destination = path.join(f.root, "restored");
  await restoreEvidenceBackup({
    archive: f.input.output,
    keyFile: f.input.keyFile,
    destination,
    isolatedDestination: true,
  });
  expect(await readFile(path.join(destination, `snapshots/${f.snapshotId}/tracked.patch`))).toEqual(
    f.patch,
  );
  expect(
    await readFile(path.join(destination, `snapshots/${f.snapshotId}/untracked/new.bin`)),
  ).toEqual(f.fresh);
  expect(await readFile(path.join(destination, `result-journal/${f.eventId}.json`))).toEqual(
    await readFile(path.join(f.input.journal, `${f.eventId}.json`)),
  );
  expect((await lstat(destination)).mode & 0o777).toBe(0o700);
});
it.each(["corruption", "wrong-key"])(
  "rejects %s before creating any restore destination",
  async (mode) => {
    const f = await fixture();
    await createEvidenceBackup(f.input);
    if (mode === "corruption") {
      const bytes = await readFile(f.input.output);
      bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1;
      await writeFile(f.input.output, bytes);
    } else await writeFile(f.input.keyFile, randomBytes(32));
    const destination = path.join(f.root, "must-not-exist");
    await expect(
      restoreEvidenceBackup({
        archive: f.input.output,
        keyFile: f.input.keyFile,
        destination,
        isolatedDestination: true,
      }),
    ).rejects.toThrow("authentication");
    await expect(lstat(destination)).rejects.toMatchObject({ code: "ENOENT" });
  },
);
it.each(["symlink", "hardlink", "secret", "extra", "corrupt-snapshot"])(
  "refuses unsafe source %s without publishing an archive",
  async (mode) => {
    const f = await fixture();
    if (mode === "symlink") {
      await rm(path.join(f.folder, "tracked.patch"));
      await symlink(f.input.databaseDump, path.join(f.folder, "tracked.patch"));
    }
    if (mode === "hardlink") {
      await rm(path.join(f.folder, "tracked.patch"));
      await link(f.input.databaseDump, path.join(f.folder, "tracked.patch"));
    }
    if (mode === "secret")
      await writeFile(path.join(f.folder, "untracked/auth.json"), "synthetic", { mode: 0o600 });
    if (mode === "extra")
      await writeFile(path.join(f.input.snapshots, "unexpected.json"), "synthetic", {
        mode: 0o600,
      });
    if (mode === "corrupt-snapshot")
      await writeFile(path.join(f.folder, "tracked.patch"), "changed");
    await expect(createEvidenceBackup(f.input)).rejects.toThrow();
    await expect(lstat(f.input.output)).rejects.toMatchObject({ code: "ENOENT" });
  },
);
it("requires stop/isolation confirmations and never overwrites source evidence or destinations", async () => {
  const f = await fixture();
  await expect(createEvidenceBackup({ ...f.input, servicesStopped: false })).rejects.toThrow(
    "physically stopped",
  );
  await createEvidenceBackup(f.input);
  const archive = await readFile(f.input.output);
  await expect(createEvidenceBackup(f.input)).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(f.input.output)).toEqual(archive);
  await expect(
    restoreEvidenceBackup({
      archive: f.input.output,
      keyFile: f.input.keyFile,
      destination: path.join(f.root, "new"),
      isolatedDestination: false,
    }),
  ).rejects.toThrow("isolated");
  await expect(
    restoreEvidenceBackup({
      archive: f.input.output,
      keyFile: f.input.keyFile,
      destination: f.input.snapshots,
      isolatedDestination: true,
    }),
  ).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(path.join(f.folder, "tracked.patch"))).toEqual(f.patch);
});
it("refuses permissive keys and dump formats and validates private roots", async () => {
  const f = await fixture();
  await chmod(f.input.keyFile, 0o644);
  await expect(createEvidenceBackup(f.input)).rejects.toThrow("Unsafe");
  await chmod(f.input.keyFile, 0o600);
  await writeFile(f.input.databaseDump, "not-custom-format");
  await expect(createEvidenceBackup(f.input)).rejects.toThrow("PostgreSQL");
  await chmod(f.input.snapshots, 0o755);
  await expect(createEvidenceBackup(f.input)).rejects.toThrow("private");
});

it.each(["traversal", "duplicate", "control"])(
  "rejects authenticated malicious %s before restore writes",
  async (mode) => {
    const f = await fixture();
    await createEvidenceBackup(f.input);
    const archive = await readFile(f.input.output);
    const key = await readFile(f.input.keyFile);
    const magic = archive.subarray(0, 8);
    const decipher = createDecipheriv("aes-256-gcm", key, archive.subarray(8, 20));
    decipher.setAAD(magic);
    decipher.setAuthTag(archive.subarray(20, 36));
    const payload = JSON.parse(
      Buffer.concat([decipher.update(archive.subarray(36)), decipher.final()]).toString(),
    );
    if (mode === "traversal") payload.files[0].path = "../outside.dump";
    else if (mode === "control")
      payload.files[0].path = `snapshots/${f.snapshotId}/untracked/invalid\u0000name`;
    else payload.files.push(payload.files[0]);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(magic);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(payload))),
      cipher.final(),
    ]);
    await writeFile(f.input.output, Buffer.concat([magic, nonce, cipher.getAuthTag(), encrypted]));
    const destination = path.join(f.root, "must-not-exist");
    await expect(
      restoreEvidenceBackup({
        archive: f.input.output,
        keyFile: f.input.keyFile,
        destination,
        isolatedDestination: true,
      }),
    ).rejects.toThrow("unsafe or duplicate");
    await expect(lstat(destination)).rejects.toMatchObject({ code: "ENOENT" });
  },
);
it("refuses oversized sparse sources before allocating or publishing a backup", async () => {
  const f = await fixture();
  const file = await open(f.input.databaseDump, "r+");
  try {
    await file.truncate(64 * 1024 * 1024 + 1);
  } finally {
    await file.close();
  }
  await expect(createEvidenceBackup(f.input)).rejects.toThrow("oversized");
  await expect(lstat(f.input.output)).rejects.toMatchObject({ code: "ENOENT" });
});

it("keeps a real Git snapshot restorable after encrypted archival and staging restore", async () => {
  const f = await fixture();
  const repository = path.join(f.root, "repository");
  await mkdir(repository, { mode: 0o700 });
  const git = (...args: string[]) =>
    execFileSync("/usr/bin/git", ["-C", repository, "-c", "core.hooksPath=/dev/null", ...args], {
      stdio: "pipe",
    })
      .toString()
      .trim();
  git("init");
  git("config", "user.name", "Synthetic Backup Test");
  git("config", "user.email", "synthetic@example.invalid");
  await writeFile(path.join(repository, "value.txt"), "baseline");
  git("add", "value.txt");
  git("commit", "-m", "synthetic baseline");
  const base = git("rev-parse", "HEAD");
  await writeFile(path.join(repository, "value.txt"), "preserved change");
  await writeFile(path.join(repository, "new.bin"), Buffer.from([0, 255, 4]));
  const snapshot = await new SnapshotManager(f.input.snapshots).capture({
    schemaVersion: 1,
    workspacePath: repository,
    limits: { maxUntrackedFiles: 10, maxArtifactBytes: 65_536 },
  });
  await createEvidenceBackup(f.input);
  const destination = path.join(f.root, "restored");
  await restoreEvidenceBackup({
    archive: f.input.output,
    keyFile: f.input.keyFile,
    destination,
    isolatedDestination: true,
  });
  const target = path.join(f.root, "target");
  git("worktree", "add", "--detach", target, base);
  await new SnapshotManager(path.join(destination, "snapshots")).restore(
    {
      ...snapshot,
      artifactPath: path.join(destination, "snapshots", snapshot.manifest.snapshotId),
    },
    target,
  );
  expect(await readFile(path.join(target, "value.txt"), "utf8")).toBe("preserved change");
  expect(await readFile(path.join(target, "new.bin"))).toEqual(Buffer.from([0, 255, 4]));
});
