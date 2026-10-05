import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { ContextBuildRequest } from "@le-fabrique/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContextBuilder } from "./context-builder";

let workspace = "";

function request(overrides: Partial<ContextBuildRequest> = {}): ContextBuildRequest {
  return {
    schemaVersion: 1,
    workspacePath: workspace,
    baseRevision: "7044a0a932cb38f2b3c2f70c07fb0be34523ab13",
    sources: [
      { path: "src/second.ts", role: "SOURCE" },
      { path: "AGENTS.md", role: "INSTRUCTION" },
      { path: "src/first.ts", role: "SOURCE" },
    ],
    limits: { maxFiles: 20, maxFileBytes: 4_096, maxTotalBytes: 16_384 },
    ...overrides,
  };
}

beforeEach(async () => {
  workspace = await mkdtemp(resolve(tmpdir(), "le-fabrique-context-"));
  await mkdir(resolve(workspace, "src"));
  await writeFile(resolve(workspace, "AGENTS.md"), "instruction\n");
  await writeFile(resolve(workspace, "src/first.ts"), "export const first = 1;\n");
  await writeFile(resolve(workspace, "src/second.ts"), "export const second = 2;\n");
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("ContextBuilder", () => {
  it("builds a stable, hashed manifest in lexical path order", async () => {
    const builder = new ContextBuilder();
    const first = await builder.build(request());
    const second = await builder.build(request());

    expect(first).toEqual(second);
    expect(first.manifest.sources.map((source) => source.path)).toEqual([
      "AGENTS.md",
      "src/first.ts",
      "src/second.ts",
    ]);
    expect(first.manifest.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.manifest.sources.every((source) => /^[0-9a-f]{64}$/.test(source.sha256))).toBe(
      true,
    );
    expect(first.manifest.truncated).toBe(false);
  });

  it("omits traversal, dependencies, secret paths, binary files and detected secrets", async () => {
    await mkdir(resolve(workspace, "node_modules"));
    await writeFile(resolve(workspace, "node_modules/dependency.js"), "dependency");
    await writeFile(resolve(workspace, ".env"), "SAFE=false");
    await writeFile(resolve(workspace, "binary.dat"), Buffer.from([0, 1, 2]));
    await writeFile(resolve(workspace, "leaked.txt"), "api_key=abcdefghijklmnopqrstuv");

    const result = await new ContextBuilder().build(
      request({
        sources: [
          { path: "../outside", role: "SOURCE" },
          { path: "node_modules/dependency.js", role: "SOURCE" },
          { path: ".env", role: "SOURCE" },
          { path: "binary.dat", role: "SOURCE" },
          { path: "leaked.txt", role: "SOURCE" },
        ],
      }),
    );

    expect(result.manifest.sources).toHaveLength(0);
    expect(result.manifest.omissions.map(({ reason }) => reason)).toEqual([
      "INVALID_PATH",
      "SECRET_PATH",
      "BINARY",
      "SECRET_DETECTED",
      "DEPENDENCY_OR_GENERATED",
    ]);
  });

  it("omits symlinks and reports file and total limits", async () => {
    await symlink(resolve(workspace, "src/first.ts"), resolve(workspace, "linked.ts"));
    await writeFile(resolve(workspace, "large.txt"), "x".repeat(40));
    const result = await new ContextBuilder().build(
      request({
        sources: [
          { path: "linked.ts", role: "SOURCE" },
          { path: "large.txt", role: "SOURCE" },
          { path: "src/first.ts", role: "SOURCE" },
          { path: "src/second.ts", role: "SOURCE" },
        ],
        limits: { maxFiles: 2, maxFileBytes: 30, maxTotalBytes: 30 },
      }),
    );

    expect(result.manifest.sources.map(({ path }) => path)).toEqual(["src/first.ts"]);
    expect(result.manifest.omissions).toEqual([
      { path: "large.txt", role: "SOURCE", reason: "FILE_TOO_LARGE" },
      { path: "linked.ts", role: "SOURCE", reason: "SYMLINK" },
      { path: "src/second.ts", role: "SOURCE", reason: "TOTAL_BYTES_LIMIT" },
    ]);
    expect(result.manifest.truncated).toBe(true);
  });

  it("reports every source omitted by the file-count limit", async () => {
    const result = await new ContextBuilder().build(
      request({ limits: { maxFiles: 1, maxFileBytes: 4_096, maxTotalBytes: 16_384 } }),
    );

    expect(result.manifest.sources.map(({ path }) => path)).toEqual(["AGENTS.md"]);
    expect(result.manifest.omissions).toEqual([
      { path: "src/first.ts", role: "SOURCE", reason: "FILE_LIMIT" },
      { path: "src/second.ts", role: "SOURCE", reason: "FILE_LIMIT" },
    ]);
  });
});
