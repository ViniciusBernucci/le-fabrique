import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { DeveloperWorkflowRequest, WorkflowCheckObservation } from "@le-fabrique/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { checkDocumentation } from "./documentation-gate";

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "fac-doc-gate-"));
  roots.push(root);
  await exec("git", ["init", root]);
  await writeFile(path.join(root, "README.md"), "Original README\n");
  await exec("git", ["-C", root, "add", "."]);
  await exec("git", [
    "-C",
    root,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-m",
    "baseline",
  ]);
  const revision = (await exec("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim();
  const request = {
    baseRevision: revision,
    documentation: {
      requiredFiles: ["README.md", "docs/delivery.md"],
      reportPath: "docs/delivery.md",
      requiredSections: ["Funcionamento", "Verificação", "Rollback"],
    },
  } as DeveloperWorkflowRequest;
  await mkdir(path.join(root, "docs"));
  const report = `# Entrega\nBase ${revision}\n## Funcionamento\nValidação aplicada.\n## Verificação\nunit: medido pelo supervisor após edição; ver evidência do resultado.\n## Rollback\nReverter o incremento após stop.\n`;
  await writeFile(path.join(root, "README.md"), "Funcionamento atualizado\n");
  await writeFile(path.join(root, "docs/delivery.md"), report);
  const checks = [{ name: "unit" }] as WorkflowCheckObservation[];
  const run = () => checkDocumentation(request, root, "a".repeat(64), checks);
  return { root, request, report, run };
}

describe("technical documentation gate", () => {
  it("binds changed tracked/untracked documents to content and snapshot hashes", async () => {
    const { run } = await fixture();
    const result = await run();
    expect(result.status).toBe("PASS");
    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.snapshotHash).toBe("a".repeat(64));
  });
  it("blocks unchanged required files and missing reports", async () => {
    const { root, run } = await fixture();
    await writeFile(path.join(root, "README.md"), "Original README\n");
    await rm(path.join(root, "docs/delivery.md"));
    expect((await run()).findings).toEqual(
      expect.arrayContaining(["UNCHANGED", "MISSING_OR_UNSAFE"]),
    );
  });
  it("blocks empty sections, placeholders, missing revision and missing checks", async () => {
    const { root, run } = await fixture();
    await writeFile(
      path.join(root, "docs/delivery.md"),
      "# Entrega\nTODO\n## Funcionamento\n## Verificação\n## Rollback\n",
    );
    expect((await run()).findings).toEqual(
      expect.arrayContaining([
        "PLACEHOLDER",
        "INCOMPLETE_SECTIONS",
        "MISSING_REVISION",
        "MISSING_CHECKS",
      ]),
    );
  });
  it("rejects both document and ancestor symlinks", async () => {
    const { root, run } = await fixture();
    await rm(path.join(root, "README.md"));
    await symlink("docs/delivery.md", path.join(root, "README.md"));
    expect((await run()).findings).toContain("MISSING_OR_UNSAFE");
    await rm(path.join(root, "docs"), { recursive: true });
    await symlink(tmpdir(), path.join(root, "docs"));
    expect((await run()).status).toBe("FAIL");
  });
  it("rejects oversized reports without truncation", async () => {
    const { root, run } = await fixture();
    await writeFile(path.join(root, "docs/delivery.md"), "x".repeat(262_145));
    expect((await run()).findings).toContain("MISSING_OR_UNSAFE");
  });
});
