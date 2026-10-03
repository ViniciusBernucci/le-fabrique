import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
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
    if (manifest.totalArtifactBytes > 48_000 || untracked.length > 1000)
      throw new Error("Artifact exceeds bounded delivery limit");
    const patch = await readSafe(path.join(directory, "tracked.patch"));
    const files = [];
    for (const entry of untracked) {
      // Shared DTO validates traversal before resolving the file.
      executionArtifactSchema.shape.files.element.shape.path.parse(entry.path);
      const bytes = await readSafe(path.join(directory, "untracked", entry.path));
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
async function readSafe(filePath: string): Promise<Buffer> {
  if ((await realpath(filePath)) !== filePath) throw new Error("Artifact symlink blocked");
  const file = await open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > 65_536 || metadata.uid !== process.getuid?.())
      throw new Error("Unsafe artifact file");
    const bytes = await file.readFile();
    if (bytes.length > 65_536) throw new Error("Artifact file limit exceeded");
    return bytes;
  } finally {
    await file.close();
  }
}
