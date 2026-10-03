import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
  ARTIFACT_JSON_MAX_BYTES,
  ARTIFACT_RAW_MAX_BYTES,
  type ExecutionArtifact,
  type ExecutionResultReport,
  executionArtifactSchema,
  verifyExecutionArtifact,
  workspaceSnapshotManifestSchema,
} from "@le-fabrique/contracts";

export class ArtifactReader {
  constructor(private readonly root: string) {
    if (!path.isAbsolute(root) || path.resolve(root) === path.parse(root).root)
      throw new Error("Artifact root must be dedicated and absolute");
  }
  async read(snapshot: ExecutionResultReport["snapshots"][number]): Promise<ExecutionArtifact> {
    const id = workspaceSnapshotManifestSchema.shape.snapshotId.parse(snapshot.snapshotId);
    const root = await realpath(this.root);
    const metadata = await lstat(this.root);
    if (
      root !== path.resolve(this.root) ||
      !metadata.isDirectory() ||
      (metadata.mode & 0o077) !== 0 ||
      metadata.uid !== process.getuid?.()
    )
      throw new Error("Artifact root must be private without symlinks");
    const directory = path.join(root, id);
    const manifest = workspaceSnapshotManifestSchema.parse(
      JSON.parse((await readSafe(path.join(directory, "manifest.json"))).toString("utf8")),
    );
    const { untracked, ...publicManifest } = manifest;
    if (
      JSON.stringify({ ...publicManifest, untrackedFiles: untracked.length }) !==
      JSON.stringify(snapshot)
    ) {
      // Compare fields explicitly: public contract ordering need not match private manifest ordering.
      const projected = { ...publicManifest, untrackedFiles: untracked.length };
      if (
        Object.keys(projected).some(
          (key) =>
            projected[key as keyof typeof projected] !== snapshot[key as keyof typeof snapshot],
        )
      )
        throw new Error("Artifact does not match persisted snapshot");
    }
    if (manifest.totalArtifactBytes > ARTIFACT_RAW_MAX_BYTES || untracked.length > 1000)
      throw new Error("Artifact exceeds bounded delivery limit");
    const declaredBytes =
      manifest.patchBytes + untracked.reduce((total, entry) => total + entry.sizeBytes, 0);
    if (declaredBytes !== manifest.totalArtifactBytes || declaredBytes > ARTIFACT_RAW_MAX_BYTES)
      throw new Error("Artifact declared sizes exceed bounded delivery limit");
    const patch = await readSafe(path.join(directory, "tracked.patch"), manifest.patchBytes);
    const files = [];
    for (const entry of untracked) {
      // Shared DTO validates traversal before resolving the file.
      executionArtifactSchema.shape.files.element.shape.path.parse(entry.path);
      const bytes = await readSafe(path.join(directory, "untracked", entry.path), entry.sizeBytes);
      files.push({ path: entry.path, dataBase64: bytes.toString("base64") });
    }
    const artifact = executionArtifactSchema.parse({
      schemaVersion: 1,
      manifest,
      patchBase64: patch.toString("base64"),
      files,
    });
    verifyExecutionArtifact(
      artifact,
      (encoded) => Buffer.from(encoded, "base64"),
      (bytes) => createHash("sha256").update(bytes).digest("hex"),
    );
    return artifact;
  }
}
async function readSafe(filePath: string, expectedBytes?: number): Promise<Buffer> {
  if ((await realpath(filePath)) !== filePath) throw new Error("Artifact symlink blocked");
  const file = await open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const metadata = await file.stat();
    if (
      !metadata.isFile() ||
      metadata.size > ARTIFACT_JSON_MAX_BYTES ||
      metadata.uid !== process.getuid?.()
    )
      throw new Error("Unsafe artifact file");
    if (expectedBytes !== undefined && metadata.size !== expectedBytes)
      throw new Error("Artifact file integrity mismatch");
    const buffer = Buffer.alloc((expectedBytes ?? ARTIFACT_JSON_MAX_BYTES) + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const bytes = buffer.subarray(0, offset);
    if (bytes.length > ARTIFACT_JSON_MAX_BYTES) throw new Error("Artifact file limit exceeded");
    if (expectedBytes !== undefined && bytes.length !== expectedBytes)
      throw new Error("Artifact file integrity mismatch");
    return bytes;
  } finally {
    await file.close();
  }
}
