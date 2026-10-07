import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runChecked, runProcess } from "./process-utils";
import { SnapshotManager } from "./snapshot-manager";
import { WorkspaceManager } from "./workspace-manager";

let fixtureRoot = "";
let repository = "";
let workspaceRoot = "";
let snapshotRoot = "";
let baseRevision = "";

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await runChecked("/usr/bin/git", ["-C", cwd, ...args])).toString("utf8").trim();
}

beforeEach(async () => {
  fixtureRoot = await mkdtemp(resolve(tmpdir(), "le-fabrique-snapshot-"));
  repository = resolve(fixtureRoot, "repository");
  workspaceRoot = resolve(fixtureRoot, "workspaces");
  snapshotRoot = resolve(fixtureRoot, "snapshots");
  await runChecked("/usr/bin/git", ["init", "--initial-branch=main", repository]);
  await git(repository, "config", "user.name", "La fabrique Test");
  await git(repository, "config", "user.email", "test@example.invalid");
  await writeFile(resolve(repository, "tracked.txt"), "base\n");
  await writeFile(resolve(repository, "binary.bin"), Buffer.from([0, 1, 2, 3]));
  await git(repository, "add", ".");
  await git(repository, "commit", "-m", "base");
  baseRevision = await git(repository, "rev-parse", "HEAD");
});

afterEach(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

describe("WorkspaceManager and SnapshotManager", () => {
  it("rejects symlinked snapshot bytes even when their hashes match", async () => {
    const workspaces = new WorkspaceManager(workspaceRoot);
    const source = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision: baseRevision,
    });
    const snapshots = new SnapshotManager(snapshotRoot);
    const snapshot = await snapshots.capture({
      schemaVersion: 1,
      workspacePath: source.workspacePath,
      limits: { maxUntrackedFiles: 10, maxArtifactBytes: 10000 },
    });
    const patch = resolve(snapshot.artifactPath, "tracked.patch");
    await rename(patch, resolve(fixtureRoot, "preserved.patch"));
    await symlink(resolve(fixtureRoot, "preserved.patch"), patch);
    const target = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision: baseRevision,
    });
    await expect(snapshots.restore(snapshot, target.workspacePath)).rejects.toThrow("symlink");
  });
  it("does not follow tracked symlink ancestors when restoring untracked files", async () => {
    await mkdir(resolve(fixtureRoot, "outside"));
    await symlink(resolve(fixtureRoot, "outside"), resolve(repository, "alias"));
    await git(repository, "add", "alias");
    await git(repository, "commit", "-m", "synthetic symlink baseline");
    const revision = await git(repository, "rev-parse", "HEAD");
    const workspaces = new WorkspaceManager(workspaceRoot);
    const source = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision,
    });
    await rm(resolve(source.workspacePath, "alias"));
    await mkdir(resolve(source.workspacePath, "alias"));
    await writeFile(resolve(source.workspacePath, "alias/new.txt"), "must remain confined");
    const snapshots = new SnapshotManager(snapshotRoot);
    const snapshot = await snapshots.capture({
      schemaVersion: 1,
      workspacePath: source.workspacePath,
      limits: { maxUntrackedFiles: 10, maxArtifactBytes: 10000 },
    });
    const target = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision,
    });
    await expect(snapshots.restore(snapshot, target.workspacePath)).rejects.toThrow("ancestor");
    await expect(readFile(resolve(fixtureRoot, "outside/new.txt"))).rejects.toThrow();
    expect(await git(target.workspacePath, "status", "--porcelain")).toBe("");
  });
  it("creates a detached worktree without moving the base branch", async () => {
    const workspace = await new WorkspaceManager(workspaceRoot).create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision: baseRevision,
    });

    expect(workspace).toMatchObject({ revision: baseRevision, detached: true });
    expect(
      (
        await runProcess("/usr/bin/git", [
          "-C",
          workspace.workspacePath,
          "symbolic-ref",
          "-q",
          "HEAD",
        ])
      ).exitCode,
    ).toBe(1);
    expect(await git(repository, "rev-parse", "main")).toBe(baseRevision);
  });

  it("captures and restores tracked, binary and untracked bytes", async () => {
    const workspaces = new WorkspaceManager(workspaceRoot);
    const source = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision: baseRevision,
    });
    await writeFile(resolve(source.workspacePath, "tracked.txt"), "changed\n");
    await writeFile(resolve(source.workspacePath, "binary.bin"), Buffer.from([0, 9, 8, 7, 6]));
    await writeFile(resolve(source.workspacePath, "untracked.bin"), Buffer.from([255, 0, 1, 2]));
    await writeFile(resolve(source.workspacePath, "executable.sh"), "#!/bin/sh\nexit 0\n");
    await chmod(resolve(source.workspacePath, "executable.sh"), 0o750);

    const snapshots = new SnapshotManager(snapshotRoot);
    const snapshot = await snapshots.capture({
      schemaVersion: 1,
      workspacePath: source.workspacePath,
      limits: { maxUntrackedFiles: 200, maxArtifactBytes: 10 * 1024 * 1024 },
    });
    const target = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision: baseRevision,
    });
    const restored = await snapshots.restore(snapshot, target.workspacePath);

    expect(restored).toMatchObject({
      baseRevision,
      patchApplied: true,
      untrackedFilesRestored: 2,
    });
    expect(await readFile(resolve(target.workspacePath, "tracked.txt"), "utf8")).toBe("changed\n");
    expect(await readFile(resolve(target.workspacePath, "binary.bin"))).toEqual(
      Buffer.from([0, 9, 8, 7, 6]),
    );
    expect(await readFile(resolve(target.workspacePath, "untracked.bin"))).toEqual(
      Buffer.from([255, 0, 1, 2]),
    );
    expect((await stat(resolve(target.workspacePath, "executable.sh"))).mode & 0o777).toBe(0o750);
    expect(await git(target.workspacePath, "status", "--porcelain", "--untracked-files=all")).toBe(
      await git(source.workspacePath, "status", "--porcelain", "--untracked-files=all"),
    );
  });

  it("rejects unsafe untracked symlinks and tampered artifacts", async () => {
    const workspaces = new WorkspaceManager(workspaceRoot);
    const workspace = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision: baseRevision,
    });
    const snapshots = new SnapshotManager(snapshotRoot);
    await symlink("/etc/passwd", resolve(workspace.workspacePath, "unsafe-link"));
    await expect(
      snapshots.capture({
        schemaVersion: 1,
        workspacePath: workspace.workspacePath,
        limits: { maxUntrackedFiles: 200, maxArtifactBytes: 10 * 1024 * 1024 },
      }),
    ).rejects.toThrow("Unsafe untracked symlink");
    await rm(resolve(workspace.workspacePath, "unsafe-link"));
    await writeFile(resolve(workspace.workspacePath, "tracked.txt"), "changed\n");
    const snapshot = await snapshots.capture({
      schemaVersion: 1,
      workspacePath: workspace.workspacePath,
      limits: { maxUntrackedFiles: 200, maxArtifactBytes: 10 * 1024 * 1024 },
    });
    await writeFile(resolve(snapshot.artifactPath, "tracked.patch"), "tampered");
    const target = await workspaces.create({
      executionId: crypto.randomUUID(),
      repositoryPath: repository,
      revision: baseRevision,
    });
    await expect(snapshots.restore(snapshot, target.workspacePath)).rejects.toThrow(
      "integrity verification",
    );
  });
});
