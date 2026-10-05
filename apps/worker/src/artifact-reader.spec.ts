import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { SnapshotManager } from "@le-fabrique/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactReader } from "./artifact-reader";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "fac-012p-artifact-"));
  roots.push(root);
  const repo = path.join(root, "repo");
  const snapshots = path.join(root, "snapshots");
  await mkdir(repo, { mode: 0o700 });
  const git = async (...args: string[]) =>
    await promisify(execFile)("/usr/bin/git", ["-C", repo, ...args], {
      env: { PATH: "/usr/bin:/bin", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
    });
  await git("init");
  await git("config", "user.email", "synthetic@example.test");
  await git("config", "user.name", "Synthetic");
  await writeFile(path.join(repo, "a.ts"), "export const a = 1;\n");
  await git("add", "a.ts");
  await git("commit", "-m", "synthetic");
  await writeFile(path.join(repo, "a.ts"), "export const a = 2;\n");
  await writeFile(path.join(repo, "new.ts"), "export const b = 3;\n");
  const snapshot = await new SnapshotManager(snapshots).capture({
    schemaVersion: 1,
    workspacePath: repo,
    limits: { maxUntrackedFiles: 10, maxArtifactBytes: 100_000 },
  });
  const { untracked, ...manifest } = snapshot.manifest;
  return {
    root,
    snapshots,
    snapshot,
    report: { ...manifest, untrackedFiles: untracked.length },
    reader: new ArtifactReader(snapshots),
  };
}
describe("ArtifactReader", () => {
  it("refuses inconsistent declared totals before reading artifact content", async () => {
    const f = await fixture();
    await writeFile(
      path.join(f.snapshot.artifactPath, "manifest.json"),
      JSON.stringify({ ...f.snapshot.manifest, totalArtifactBytes: 1 }),
    );
    await expect(f.reader.read({ ...f.report, totalArtifactBytes: 1 })).rejects.toThrow(
      "declared sizes",
    );
  });
  it("delivers a real Git snapshot above the former 64 KiB limit without truncation", async () => {
    const f = await fixture();
    const repo = path.join(f.root, "repo");
    const content = Buffer.alloc(256 * 1024, 0x61);
    await writeFile(path.join(repo, "asset.bin"), content);
    const captured = await new SnapshotManager(f.snapshots).capture({
      schemaVersion: 1,
      workspacePath: repo,
      limits: { maxUntrackedFiles: 10, maxArtifactBytes: 1024 * 1024 },
    });
    const { untracked, ...manifest } = captured.manifest;
    const artifact = await f.reader.read({ ...manifest, untrackedFiles: untracked.length });
    const file = artifact.files.find((entry) => entry.path === "asset.bin");
    if (!file) throw new Error("Missing fixture asset");
    expect(Buffer.from(file.dataBase64, "base64")).toEqual(content);
  });
  it("exports an actual Git patch and untracked file with exact integrity", async () => {
    const f = await fixture();
    const artifact = await f.reader.read(f.report);
    expect(Buffer.from(artifact.patchBase64, "base64").toString()).toContain(
      "+export const a = 2;",
    );
    expect(Buffer.from(artifact.files[0].dataBase64, "base64").toString()).toBe(
      "export const b = 3;\n",
    );
    expect(artifact).not.toHaveProperty("artifactPath");
  });
  it("rejects mismatched report and corrupted stored patch", async () => {
    const f = await fixture();
    await expect(f.reader.read({ ...f.report, manifestHash: "f".repeat(64) })).rejects.toThrow(
      "persisted snapshot",
    );
    await writeFile(path.join(f.snapshot.artifactPath, "tracked.patch"), "corrupt");
    await expect(f.reader.read(f.report)).rejects.toThrow("integrity mismatch");
  });
  it("blocks symlink replacements without exposing outside contents", async () => {
    const f = await fixture();
    const file = path.join(f.snapshot.artifactPath, "untracked", "new.ts");
    await rm(file);
    const outside = path.join(f.root, "private");
    await writeFile(outside, "private");
    await symlink(outside, file);
    await expect(f.reader.read(f.report)).rejects.toThrow("symlink");
  });
});
