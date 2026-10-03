import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, chmod, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(repo, "node_modules/tsx/dist/cli.mjs");
const script = path.join(repo, "scripts/fac-012aa-claude-preflight.ts");
const environment = { PATH: "/usr/bin:/bin" };

test("preflight refuses missing confirmation and inherited API keys before creating identities", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "preflight-negative-"));
  try {
    const args = [
      cli,
      script,
      "--provider-root",
      root,
      "--installation",
      "fixture-account",
      "--binary",
      process.execPath,
      "--model",
      "fixture-model",
    ];
    await assert.rejects(exec(process.execPath, args, { env: environment }), (error) =>
      error.stderr.includes('"stage":"CONFIGURATION"'),
    );
    await assert.rejects(
      exec(process.execPath, [...args, "--confirm-subscription-only", "--confirm-worker-stopped"], {
        env: { ...environment, ANTHROPIC_API_KEY: "synthetic-refused" },
      }),
      (error) => error.stderr.includes('"stage":"CONFIGURATION"'),
    );
    await assert.rejects(access(path.join(root, "claude-fixture-account")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preflight rejects a successful synthetic turn without native tool evidence and publishes no proof", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "preflight-model-claim-"));
  try {
    const binary = path.join(root, "fake-claude");
    const fixture = path.join(repo, "packages/runtime/src/fixtures/fake-claude.cjs");
    await writeFile(binary, `#!${process.execPath}\nrequire(${JSON.stringify(fixture)});\n`, {
      mode: 0o700,
    });
    await chmod(root, 0o700);
    const args = [
      cli,
      script,
      "--provider-root",
      root,
      "--installation",
      "fixture-account",
      "--binary",
      binary,
      "--model",
      "fixture-model",
      "--confirm-subscription-only",
      "--confirm-worker-stopped",
    ];
    await assert.rejects(exec(process.execPath, args, { env: environment }), (error) =>
      error.stderr.includes('"stage":"PERMITTED_TOOLS"'),
    );
    await assert.rejects(access(path.join(root, "claude-fixture-account", "confinement.json")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("synthetic complete native trace publishes private binary-bound proof and retires the previous proof", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "preflight-synthetic-proof-"));
  const fixtures = [];
  try {
    const binary = path.join(root, "fake-claude");
    const fixture = path.join(repo, "scripts/fixtures/fake-claude-preflight.cjs");
    await writeFile(binary, `#!${process.execPath}\nrequire(${JSON.stringify(fixture)});\n`, {
      mode: 0o700,
    });
    const args = [
      cli,
      script,
      "--provider-root",
      root,
      "--installation",
      "fixture-account",
      "--binary",
      binary,
      "--model",
      "fixture-model",
      "--confirm-subscription-only",
      "--confirm-worker-stopped",
    ];
    for (let i = 0; i < 2; i += 1) {
      const result = await exec(process.execPath, args, { env: environment });
      const summary = JSON.parse(result.stdout);
      fixtures.push(summary.fixtureRoot);
      assert.equal(summary.status, "PASS");
      assert.equal(summary.deniedCases.length, 14);
      assert.equal(summary.modelEffective, "synthetic-preflight-model");
      const proofPath = path.join(root, "claude-fixture-account/confinement.json");
      const proof = JSON.parse(await readFile(proofPath, "utf8"));
      assert.equal(proof.binarySha256, summary.binarySha256);
      assert.equal((await stat(proofPath)).mode & 0o077, 0);
    }
    const preserved = await readdir(path.join(root, "claude-fixture-account"));
    assert.equal(
      preserved.filter((file) => file.startsWith("confinement.json.superseded-")).length,
      1,
    );
  } finally {
    for (const fixture of fixtures) await rm(fixture, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
});
