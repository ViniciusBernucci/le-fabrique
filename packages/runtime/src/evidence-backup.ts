import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import {
  type EvidenceBackupPayload,
  evidenceBackupPayloadSchema,
  workspaceSnapshotManifestSchema,
} from "@le-fabrique/contracts";

const MAGIC = Buffer.from("LFBACK01");
const MAX_RAW = 64 * 1024 * 1024;
const MAX_ARCHIVE = 96 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type BackupFile = EvidenceBackupPayload["files"][number];

function allowedFile(value: string): boolean {
  if (value === "database.dump") return true;
  if (
    value.includes("\\") ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    value
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /^(?:\.env(?:\..*)?|auth\.json|credentials.*|\.git|\.codex|\.claude)$/i.test(part),
      )
  )
    return false;
  const parts = value.split("/");
  if (parts[0] === "result-journal")
    return (
      parts.length === 2 &&
      UUID.test(parts[1]?.slice(0, -5) ?? "") &&
      parts[1]?.endsWith(".json") === true
    );
  if (parts[0] !== "snapshots" || !UUID.test(parts[1] ?? "")) return false;
  return (
    (parts.length === 3 && ["manifest.json", "tracked.patch"].includes(parts[2] ?? "")) ||
    (parts.length >= 4 && parts.length <= 35 && parts[2] === "untracked")
  );
}

async function privateDirectory(input: string): Promise<string> {
  if (
    !path.isAbsolute(input) ||
    path.resolve(input) !== input ||
    path.parse(input).root === input ||
    (await realpath(input)) !== input
  )
    throw new Error("Backup requires canonical dedicated paths");
  const metadata = await lstat(input);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== process.getuid?.() ||
    (metadata.mode & 0o077) !== 0
  )
    throw new Error("Backup directory is not private and owned");
  return input;
}

async function boundedFile(input: string, maximum: number, privateMode = false) {
  // Ancestors are checked separately; final component cannot be a link/FIFO/device.
  const file = await open(input, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.uid !== process.getuid?.() ||
      before.size > maximum ||
      (privateMode && (before.mode & 0o077) !== 0)
    )
      throw new Error("Unsafe or oversized backup file");
    const bytes = Buffer.alloc(before.size + 1);
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    const after = await file.stat();
    if (
      bytesRead !== before.size ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs
    )
      throw new Error("Backup source changed during read");
    return { bytes: bytes.subarray(0, bytesRead), mode: before.mode & 0o777 };
  } finally {
    await file.close();
  }
}

async function keyBytes(file: string): Promise<Buffer> {
  await privateDirectory(path.dirname(file));
  if (!path.isAbsolute(file) || path.resolve(file) !== file || (await realpath(file)) !== file)
    throw new Error("Backup key must be canonical");
  const { bytes } = await boundedFile(file, 32, true);
  if (bytes.length !== 32) throw new Error("Backup key must contain exactly 32 random bytes");
  return bytes;
}

function validatePayload(input: unknown): {
  payload: EvidenceBackupPayload;
  bytes: Map<string, Buffer>;
} {
  const payload = evidenceBackupPayloadSchema.parse(input);
  const bytes = new Map<string, Buffer>();
  let total = 0;
  for (const file of payload.files) {
    if (!allowedFile(file.path) || bytes.has(file.path))
      throw new Error("Backup contains an unsafe or duplicate path");
    const decoded = Buffer.from(file.contentBase64, "base64");
    total += decoded.length;
    if (
      total > MAX_RAW ||
      decoded.length !== file.sizeBytes ||
      decoded.toString("base64") !== file.contentBase64 ||
      digest(decoded) !== file.sha256
    )
      throw new Error("Backup content integrity or budget failed");
    bytes.set(file.path, decoded);
  }
  if (!bytes.get("database.dump")?.subarray(0, 5).equals(Buffer.from("PGDMP")))
    throw new Error("Backup requires a PostgreSQL custom-format dump");
  const snapshots = new Set(
    payload.files
      .filter((file) => file.path.startsWith("snapshots/"))
      .map((file) => file.path.split("/")[1] as string),
  );
  for (const snapshotId of snapshots) {
    const prefix = `snapshots/${snapshotId}/`;
    const manifestBytes = bytes.get(`${prefix}manifest.json`);
    const patch = bytes.get(`${prefix}tracked.patch`);
    if (!manifestBytes || manifestBytes.length > 256 * 1024 || !patch)
      throw new Error("Backup snapshot is incomplete");
    const manifest = workspaceSnapshotManifestSchema.parse(
      JSON.parse(manifestBytes.toString("utf8")),
    );
    const { manifestHash, ...core } = manifest;
    if (
      manifest.snapshotId !== snapshotId ||
      digest(Buffer.from(JSON.stringify(core))) !== manifestHash ||
      patch.length !== manifest.patchBytes ||
      digest(patch) !== manifest.patchSha256
    )
      throw new Error("Backup snapshot integrity failed");
    let snapshotBytes = patch.length;
    for (const entry of manifest.untracked) {
      const relative = `${prefix}untracked/${entry.path}`;
      if (!allowedFile(relative)) throw new Error("Unsafe snapshot entry");
      const content = bytes.get(relative);
      const stored = payload.files.find((file) => file.path === relative);
      if (
        !content ||
        content.length !== entry.sizeBytes ||
        digest(content) !== entry.sha256 ||
        stored?.mode !== entry.mode
      )
        throw new Error("Backup untracked integrity failed");
      snapshotBytes += content.length;
    }
    if (
      snapshotBytes !== manifest.totalArtifactBytes ||
      payload.files.filter((file) => file.path.startsWith(prefix)).length !==
        manifest.untracked.length + 2
    )
      throw new Error("Backup snapshot file set differs from manifest");
  }
  for (const file of payload.files.filter((item) => item.path.startsWith("result-journal/"))) {
    if (file.sizeBytes > 131_072 || (file.mode & 0o077) !== 0)
      throw new Error("Unsafe backup journal");
    const value = JSON.parse((bytes.get(file.path) as Buffer).toString("utf8"));
    const { entryHash, ...core } = value;
    if (
      core.schemaVersion !== 1 ||
      file.path !== `result-journal/${core.eventId}.json` ||
      !UUID.test(core.eventId) ||
      typeof core.jobDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(core.jobDigest) ||
      digest(Buffer.from(JSON.stringify(core))) !== entryHash
    )
      throw new Error("Backup journal integrity failed");
  }
  return { payload, bytes };
}

async function archiveContents(archive: string, keyFile: string) {
  await privateDirectory(path.dirname(archive));
  if ((await realpath(archive)) !== archive) throw new Error("Backup archive must be canonical");
  const { bytes } = await boundedFile(archive, MAX_ARCHIVE, true);
  if (bytes.length < 36 || !bytes.subarray(0, 8).equals(MAGIC))
    throw new Error("Unsupported backup format");
  const decipher = createDecipheriv("aes-256-gcm", await keyBytes(keyFile), bytes.subarray(8, 20));
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(bytes.subarray(20, 36));
  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]);
  } catch {
    throw new Error("Backup authentication failed");
  }
  return validatePayload(JSON.parse(plaintext.toString("utf8")));
}

export async function createEvidenceBackup(input: {
  databaseDump: string;
  snapshots: string;
  journal: string;
  keyFile: string;
  output: string;
  servicesStopped: boolean;
}) {
  if (input.servicesStopped !== true)
    throw new Error("Confirm control and worker are physically stopped before backup");
  const snapshots = await privateDirectory(input.snapshots);
  const journal = await privateDirectory(input.journal);
  if (
    snapshots === journal ||
    snapshots.startsWith(`${journal}/`) ||
    journal.startsWith(`${snapshots}/`)
  )
    throw new Error("Backup component roots must be separate");
  await privateDirectory(path.dirname(input.databaseDump));
  if ((await realpath(input.databaseDump)) !== input.databaseDump)
    throw new Error("Backup dump must be canonical");
  const outputParent = await privateDirectory(path.dirname(input.output));
  if (
    !path.isAbsolute(input.output) ||
    path.resolve(input.output) !== input.output ||
    [snapshots, journal].some(
      (root) => input.output.startsWith(`${root}/`) || input.keyFile.startsWith(`${root}/`),
    )
  )
    throw new Error("Backup output/key and sources must be separate");
  const files: BackupFile[] = [];
  let raw = 0;
  const append = async (source: string, relative: string, requirePrivate = false) => {
    if (!allowedFile(relative) || files.length >= 4096)
      throw new Error("Backup source path/count is invalid");
    const content = await boundedFile(source, MAX_RAW - raw, requirePrivate);
    raw += content.bytes.length;
    files.push({
      path: relative,
      mode: content.mode,
      sizeBytes: content.bytes.length,
      sha256: digest(content.bytes),
      contentBase64: content.bytes.toString("base64"),
    });
  };
  await append(input.databaseDump, "database.dump", true);
  let visited = 0;
  const walk = async (directory: string, prefix: string, depth = 0) => {
    if (depth > 34 || (await realpath(directory)) !== directory)
      throw new Error("Unsafe backup directory tree");
    const meta = await lstat(directory);
    if (
      !meta.isDirectory() ||
      meta.isSymbolicLink() ||
      meta.uid !== process.getuid?.() ||
      (meta.mode & 0o077) !== 0
    )
      throw new Error("Unsafe backup directory tree");
    for await (const entry of await opendir(directory)) {
      if (++visited > 8192) throw new Error("Backup directory entry budget exceeded");
      const relative = `${prefix}/${entry.name}`;
      const source = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (
          prefix === "result-journal" ||
          (prefix === "snapshots" && !UUID.test(entry.name)) ||
          (prefix.split("/").length === 2 && entry.name !== "untracked")
        )
          throw new Error("Unexpected backup directory");
        await walk(source, relative, depth + 1);
      } else if (entry.isFile())
        await append(source, relative, prefix.startsWith("result-journal"));
      else throw new Error("Backup refuses links and special files");
    }
  };
  await walk(snapshots, "snapshots");
  await walk(journal, "result-journal");
  const payload = validatePayload({
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  }).payload;
  const plaintext = Buffer.from(JSON.stringify(payload));
  if (plaintext.length + 36 > MAX_ARCHIVE) throw new Error("Backup archive budget exceeded");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await keyBytes(input.keyFile), nonce);
  cipher.setAAD(MAGIC);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const file = await open(
    path.join(outputParent, path.basename(input.output)),
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.writeFile(Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), ciphertext]));
    await file.sync();
  } finally {
    await file.close();
  }
  return { files: files.length, rawBytes: raw, archiveBytes: ciphertext.length + 36 };
}

export async function verifyEvidenceBackup(input: { archive: string; keyFile: string }) {
  const { payload } = await archiveContents(input.archive, input.keyFile);
  return {
    createdAt: payload.createdAt,
    files: payload.files.length,
    rawBytes: payload.files.reduce((sum, file) => sum + file.sizeBytes, 0),
  };
}

export async function restoreEvidenceBackup(input: {
  archive: string;
  keyFile: string;
  destination: string;
  isolatedDestination: boolean;
}) {
  if (input.isolatedDestination !== true)
    throw new Error("Confirm an isolated restore destination");
  const { payload, bytes } = await archiveContents(input.archive, input.keyFile);
  await privateDirectory(path.dirname(input.destination));
  if (!path.isAbsolute(input.destination) || path.resolve(input.destination) !== input.destination)
    throw new Error("Restore destination must be canonical and new");
  await mkdir(input.destination, { mode: 0o700 }); // Exclusive: existing destinations are never touched.
  await mkdir(path.join(input.destination, "snapshots"), { mode: 0o700 });
  await mkdir(path.join(input.destination, "result-journal"), { mode: 0o700 });
  for (const entry of payload.files) {
    const target = path.join(input.destination, entry.path);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const file = await open(
      target,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(bytes.get(entry.path) as Buffer);
      await file.sync();
    } finally {
      await file.close();
    }
    await chmod(target, entry.mode);
  }
  for (const entry of payload.files.filter((file) => file.path.endsWith("/manifest.json")))
    await mkdir(path.join(input.destination, path.dirname(entry.path), "untracked"), {
      recursive: true,
      mode: 0o700,
    });
  return { files: payload.files.length, destination: input.destination };
}
