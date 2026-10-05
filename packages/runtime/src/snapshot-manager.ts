import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import type {
  SnapshotCaptureRequest,
  SnapshotRestoreResult,
  SnapshotUntrackedEntry,
  WorkspaceSnapshot,
  WorkspaceSnapshotManifest,
} from "@le-fabrique/contracts";
import {
  snapshotCaptureRequestSchema,
  snapshotRestoreResultSchema,
  workspaceSnapshotManifestSchema,
  workspaceSnapshotSchema,
} from "@le-fabrique/contracts";
import { runChecked } from "./process-utils";

export class SnapshotManager {
  constructor(private readonly snapshotRoot: string) {
    if (!isAbsolute(snapshotRoot)) throw new Error("Snapshot root must be absolute");
  }

  async capture(input: SnapshotCaptureRequest): Promise<WorkspaceSnapshot> {
    const request = snapshotCaptureRequestSchema.parse(input);
    const workspace = await repositoryRoot(request.workspacePath);
    const root = await this.ensureRoot();
    if (root.startsWith(`${workspace}${sep}`) || workspace.startsWith(`${root}${sep}`)) {
      throw new Error("Snapshot root and workspace must be separate");
    }
    const baseRevision = await gitText(workspace, ["rev-parse", "HEAD"]);
    const headRevision = baseRevision;
    const patch = await runChecked(
      "/usr/bin/git",
      ["-C", workspace, "diff", "--binary", "--full-index", "--no-ext-diff", "HEAD", "--"],
      { maxBytes: request.limits.maxArtifactBytes + 1 },
    );
    const untrackedOutput = await runChecked(
      "/usr/bin/git",
      ["-C", workspace, "ls-files", "--others", "--exclude-standard", "-z"],
      { maxBytes: request.limits.maxArtifactBytes + 1 },
    );
    const paths = untrackedOutput.toString("utf8").split("\0").filter(Boolean).sort(compareText);
    if (paths.length > request.limits.maxUntrackedFiles) {
      throw new Error("Snapshot untracked file limit exceeded");
    }

    const snapshotId = randomUUID();
    const artifactPath = resolve(root, snapshotId);
    const untrackedRoot = resolve(artifactPath, "untracked");
    await mkdir(untrackedRoot, { recursive: true, mode: 0o700 });
    try {
      await writeFile(resolve(artifactPath, "tracked.patch"), patch, { mode: 0o600 });
      const untracked: SnapshotUntrackedEntry[] = [];
      let totalArtifactBytes = patch.byteLength;
      for (const path of paths) {
        validateRelativePath(path);
        const source = resolve(workspace, path);
        const metadata = await lstat(source);
        if (metadata.isSymbolicLink()) throw new Error(`Unsafe untracked symlink: ${path}`);
        if (!metadata.isFile()) throw new Error(`Unsupported untracked entry: ${path}`);
        totalArtifactBytes += metadata.size;
        if (totalArtifactBytes > request.limits.maxArtifactBytes) {
          throw new Error("Snapshot artifact byte limit exceeded");
        }
        const target = resolve(untrackedRoot, path);
        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
        await copyFile(source, target);
        const mode = metadata.mode & 0o777;
        await chmod(target, mode);
        untracked.push({
          path,
          sizeBytes: metadata.size,
          mode,
          sha256: hash(await readFile(source)),
        });
      }
      const manifestCore = {
        schemaVersion: 1 as const,
        snapshotId,
        baseRevision,
        headRevision,
        patchBytes: patch.byteLength,
        patchSha256: hash(patch),
        untracked,
        totalArtifactBytes,
        createdAt: new Date().toISOString(),
      };
      const manifest = workspaceSnapshotManifestSchema.parse({
        ...manifestCore,
        manifestHash: hash(Buffer.from(JSON.stringify(manifestCore), "utf8")),
      });
      await writeFile(resolve(artifactPath, "manifest.json"), `${JSON.stringify(manifest)}\n`, {
        mode: 0o600,
      });
      return workspaceSnapshotSchema.parse({ artifactPath, manifest });
    } catch (error) {
      await rm(artifactPath, { recursive: true, force: true });
      throw error;
    }
  }

  async restore(
    snapshotInput: WorkspaceSnapshot,
    targetWorkspacePath: string,
  ): Promise<SnapshotRestoreResult> {
    const snapshot = workspaceSnapshotSchema.parse(snapshotInput);
    const artifactPath = await realpath(snapshot.artifactPath);
    const root = await this.ensureRoot();
    if (
      artifactPath !== resolve(root, snapshot.manifest.snapshotId) ||
      artifactPath !== resolve(snapshot.artifactPath)
    )
      throw new Error("Snapshot escaped its root or contains a symlink");
    const storedManifest = workspaceSnapshotManifestSchema.parse(
      JSON.parse((await readSnapshotFile(resolve(artifactPath, "manifest.json"))).toString("utf8")),
    );
    if (JSON.stringify(storedManifest) !== JSON.stringify(snapshot.manifest)) {
      throw new Error("Snapshot manifest does not match the stored artifact");
    }
    verifyManifestHash(storedManifest);
    const patchPath = resolve(artifactPath, "tracked.patch");
    const patch = await readSnapshotFile(patchPath);
    if (
      hash(patch) !== storedManifest.patchSha256 ||
      patch.byteLength !== storedManifest.patchBytes
    ) {
      throw new Error("Snapshot patch failed integrity verification");
    }
    const sourceFiles = new Map<string, Buffer>();
    for (const entry of storedManifest.untracked) {
      validateRelativePath(entry.path);
      const bytes = await readSnapshotFile(resolve(artifactPath, "untracked", entry.path));
      if (bytes.byteLength !== entry.sizeBytes || hash(bytes) !== entry.sha256) {
        throw new Error(`Snapshot untracked file failed integrity verification: ${entry.path}`);
      }
      sourceFiles.set(entry.path, bytes);
    }

    const workspace = await repositoryRoot(targetWorkspacePath);
    if ((await gitText(workspace, ["rev-parse", "HEAD"])) !== storedManifest.baseRevision) {
      throw new Error("Restore target is not at the snapshot base revision");
    }
    if (await gitText(workspace, ["status", "--porcelain", "--untracked-files=all"])) {
      throw new Error("Restore target must be clean");
    }
    for (const entry of storedManifest.untracked)
      await validateRestoreParents(workspace, entry.path);
    if (patch.byteLength > 0) {
      await runChecked("/usr/bin/git", [
        "-C",
        workspace,
        "apply",
        "--check",
        "--binary",
        patchPath,
      ]);
      await runChecked("/usr/bin/git", ["-C", workspace, "apply", "--binary", patchPath]);
    }
    for (const entry of storedManifest.untracked) {
      await validateRestoreParents(workspace, entry.path);
      const target = resolve(workspace, entry.path);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, sourceFiles.get(entry.path) as Buffer, {
        mode: entry.mode,
        flag: "wx",
      });
      await chmod(target, entry.mode);
    }
    return snapshotRestoreResultSchema.parse({
      snapshotId: storedManifest.snapshotId,
      workspacePath: workspace,
      baseRevision: storedManifest.baseRevision,
      patchApplied: patch.byteLength > 0,
      untrackedFilesRestored: storedManifest.untracked.length,
    });
  }

  private async ensureRoot(): Promise<string> {
    await mkdir(this.snapshotRoot, { recursive: true, mode: 0o700 });
    return await realpath(this.snapshotRoot);
  }
}

async function repositoryRoot(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error("Workspace must be absolute");
  const canonical = await realpath(path);
  if (!(await stat(canonical)).isDirectory()) throw new Error("Workspace must be a directory");
  const root = await gitText(canonical, ["rev-parse", "--show-toplevel"]);
  if ((await realpath(root)) !== canonical)
    throw new Error("Workspace must be the repository root");
  return canonical;
}

async function gitText(workspace: string, args: readonly string[]): Promise<string> {
  return (
    await runChecked("/usr/bin/git", ["-C", workspace, ...args], { maxBytes: 2 * 1024 * 1024 })
  )
    .toString("utf8")
    .trim();
}

function verifyManifestHash(manifest: WorkspaceSnapshotManifest): void {
  const { manifestHash, ...core } = manifest;
  if (hash(Buffer.from(JSON.stringify(core), "utf8")) !== manifestHash) {
    throw new Error("Snapshot manifest failed integrity verification");
  }
}

function validateRelativePath(path: string): void {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path
      .split("/")
      .some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment === ".git" ||
          segment === ".codex",
      )
  ) {
    throw new Error(`Unsafe snapshot path: ${path}`);
  }
}

async function readSnapshotFile(filePath: string): Promise<Buffer> {
  if ((await realpath(filePath)) !== filePath) throw new Error("Snapshot symlink blocked");
  const file = await open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    if (!(await file.stat()).isFile()) throw new Error("Snapshot entry must be a regular file");
    return await file.readFile();
  } finally {
    await file.close();
  }
}

async function validateRestoreParents(workspace: string, relativePath: string): Promise<void> {
  validateRelativePath(relativePath);
  const segments = relativePath.split("/");
  let current = workspace;
  for (const segment of segments) {
    current = resolve(current, segment);
    try {
      const metadata = await lstat(current);
      if (
        metadata.isSymbolicLink() ||
        (current !== resolve(workspace, relativePath) && !metadata.isDirectory())
      )
        throw new Error("Unsafe restore target ancestor");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hash(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
