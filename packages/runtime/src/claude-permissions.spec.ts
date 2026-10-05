import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RuntimeExecutionRequest } from "@le-fabrique/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { claudePermissionSettings } from "./claude-permissions";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function request(
  paths: string[],
  permissionMode: "WORKSPACE_WRITE" | "READ_ONLY" = "WORKSPACE_WRITE",
) {
  const root = await mkdtemp(path.join(tmpdir(), "claude-paths-"));
  roots.push(root);
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "README.md"), "baseline");
  return {
    root,
    input: { workspacePath: root, writablePaths: paths, permissionMode } as RuntimeExecutionRequest,
  };
}
describe("Claude native granular profile", () => {
  it("uses absolute exact Edit rules for files and anchored trees for directories", async () => {
    const { root, input } = await request(["src", "README.md"]);
    const result = await claudePermissionSettings(input);
    expect(result.permissions.allow).toEqual([
      `Edit(/${root}/src)`,
      `Edit(/${root}/src/**)`,
      `Edit(/${root}/README.md)`,
    ]);
    expect(result.permissions.defaultMode).toBe("dontAsk");
    expect(result.permissions.deny).toEqual(
      expect.arrayContaining([
        "Bash",
        "Agent",
        "NotebookEdit",
        "Read(**/.git/**)",
        "Edit(**/.codex/**)",
        "Read(**/.claude/**)",
      ]),
    );
  });
  it("does not authorize writes for Reviewer even if a path is supplied", async () => {
    const { input } = await request(["src"], "READ_ONLY");
    expect((await claudePermissionSettings(input)).permissions.allow).toEqual([]);
  });
  it("rejects empty, missing, escaping, symlinked and pattern-shaped paths", async () => {
    const { root, input } = await request([]);
    for (const paths of [[], ["missing"], ["../escape"], ["src/*"]])
      await expect(claudePermissionSettings({ ...input, writablePaths: paths })).rejects.toThrow();
    await symlink(path.join(root, "src"), path.join(root, "alias"));
    await expect(
      claudePermissionSettings({ ...input, writablePaths: ["alias"] }),
    ).rejects.toThrow();
    await mkdir(path.join(root, "[src]"));
    await expect(
      claudePermissionSettings({ ...input, writablePaths: ["[src]"] }),
    ).rejects.toThrow();
  });
});
