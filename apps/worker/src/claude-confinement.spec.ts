import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CLAUDE_CONFINEMENT_POLICY } from "@le-fabrique/runtime";
import { afterEach, describe, expect, it } from "vitest";
import {
  CLAUDE_DENIED_CASES,
  cliFingerprint,
  nativePermissionDenied,
  nativePermissionSucceeded,
  requireClaudeConfinementProof,
} from "./claude-confinement";
import { ProviderIdentityManager } from "./provider-identity";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "claude-proof-"));
  roots.push(root);
  const directory = path.join(root, "claude-fixture-account");
  await mkdir(directory, { mode: 0o700 });
  const file = path.join(directory, "confinement.json");
  const proof = {
    schemaVersion: 1,
    policy: CLAUDE_CONFINEMENT_POLICY,
    installationId: "fixture-account",
    uid: process.getuid?.(),
    binarySha256: await cliFingerprint(process.execPath),
    cliVersion: "2.1.285 (Claude Code)",
    verifiedAt: new Date().toISOString(),
    subscriptionOnlyConfirmed: true,
    permittedWrite: true,
    permittedEdit: true,
    deniedCases: [...CLAUDE_DENIED_CASES],
  };
  const save = async () => {
    await writeFile(file, JSON.stringify(proof), { mode: 0o600 });
  };
  const verify = () => requireClaudeConfinementProof(root, "fixture-account", process.execPath);
  await save();
  return { root, file, proof, save, verify };
}
describe("private confinement eligibility", () => {
  it("accepts only complete current proof matching UID, installation, binary and policy", async () => {
    const f = await fixture();
    await expect(f.verify()).resolves.toMatchObject({ policy: CLAUDE_CONFINEMENT_POLICY });
    const manager = new ProviderIdentityManager(f.root, {
      CODEX: process.execPath,
      CLAUDE: process.execPath,
    });
    expect(
      (
        await manager.adapter({
          role: "DEVELOPER",
          provider: "claude",
          installationId: "fixture-account",
          model: "synthetic",
          permissionMode: "WORKSPACE_WRITE",
        })
      ).name,
    ).toBe("claude");
  });
  it("rejects changed CLI fingerprints, stale/future timestamps and missing denial cases", async () => {
    for (const mutate of [
      (proof: Awaited<ReturnType<typeof fixture>>["proof"]) => {
        proof.binarySha256 = "b".repeat(64);
      },
      (proof: Awaited<ReturnType<typeof fixture>>["proof"]) => {
        proof.verifiedAt = new Date(Date.now() - 8 * 86_400_000).toISOString();
      },
      (proof: Awaited<ReturnType<typeof fixture>>["proof"]) => {
        proof.verifiedAt = new Date(Date.now() + 60_000).toISOString();
      },
      (proof: Awaited<ReturnType<typeof fixture>>["proof"]) => {
        proof.deniedCases.pop();
      },
    ]) {
      const f = await fixture();
      mutate(f.proof);
      await f.save();
      await expect(f.verify()).rejects.toThrow("confinement");
    }
  });
  it("rejects missing, public or symlinked proof without relaxing identity permissions", async () => {
    const f = await fixture();
    await chmod(f.file, 0o644);
    await expect(f.verify()).rejects.toThrow();
    await rm(f.file);
    await expect(f.verify()).rejects.toThrow();
    const other = path.join(f.root, "elsewhere");
    await writeFile(other, JSON.stringify(f.proof), { mode: 0o600 });
    await symlink(other, f.file);
    await expect(f.verify()).rejects.toThrow();
  });
  it("requires a matching attempted native tool call and an explicit correlated error denial", () => {
    const attempt = {
      kind: "attempt" as const,
      id: "one",
      name: "Write",
      path: "/fixture/blocked",
    };
    const denial = { kind: "result" as const, id: "one", error: true, denied: true };
    expect(nativePermissionDenied([], "Write", attempt.path)).toBe(false);
    expect(nativePermissionDenied([attempt], "Write", attempt.path)).toBe(false);
    expect(
      nativePermissionDenied([attempt, { ...denial, id: "different" }], "Write", attempt.path),
    ).toBe(false);
    expect(nativePermissionDenied([attempt, denial], "Write", attempt.path)).toBe(true);
    expect(
      nativePermissionDenied(
        [attempt, denial, { ...denial, denied: false, error: false }],
        "Write",
        attempt.path,
      ),
    ).toBe(false);
    expect(nativePermissionSucceeded([attempt, denial], "Write", attempt.path)).toBe(false);
    expect(
      nativePermissionSucceeded(
        [attempt, { ...denial, error: false, denied: false }],
        "Write",
        attempt.path,
      ),
    ).toBe(true);
  });
});
