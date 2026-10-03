import { chmod, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderIdentityManager } from "./provider-identity";
import { runCodexDeviceLogin } from "./provider-onboarding.processor";
import { runVerificationCommand } from "./provider-verification.processor";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function manager() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fac-012v-identities-"));
  roots.push(root);
  return {
    root,
    identities: new ProviderIdentityManager(
      root,
      { CODEX: process.execPath, CLAUDE: process.execPath },
      {
        PATH: "/usr/bin:/bin",
        WORKER_API_TOKEN: "synthetic-control-secret",
        OPENAI_API_KEY: "synthetic-api-key",
        CLAUDE_CODE_OAUTH_TOKEN: "synthetic-oauth",
        NODE_OPTIONS: "--invalid",
        CODEX_HOME: "/wrong",
        HOME: "/wrong",
        ANTHROPIC_BASE_URL: "https://wrong.invalid",
      },
    ),
  };
}

describe("private installation identities", () => {
  it("isolates both providers and separate accounts without inheriting credentials", async () => {
    const { identities } = await manager();
    const first = await identities.prepare("CODEX", "account-a");
    const second = await identities.prepare("CODEX", "account-b");
    const claude = await identities.prepare("CLAUDE", "account-a");
    expect(
      new Set([first.environment.HOME, second.environment.HOME, claude.environment.HOME]).size,
    ).toBe(3);
    expect(first.environment.CODEX_HOME).not.toBe(second.environment.CODEX_HOME);
    expect(first.binaryArgsPrefix).toEqual([
      "-c",
      'cli_auth_credentials_store="file"',
      "-c",
      'forced_login_method="chatgpt"',
    ]);
    expect(claude.environment.CLAUDE_CONFIG_DIR).toBeTruthy();
    for (const identity of [first, second, claude]) {
      expect(identity.environment.WORKER_API_TOKEN).toBeUndefined();
      expect(identity.environment.OPENAI_API_KEY).toBeUndefined();
      expect(identity.environment.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
      expect(identity.environment.NODE_OPTIONS).toBeUndefined();
      expect(identity.environment.ANTHROPIC_BASE_URL).toBeUndefined();
    }
    expect((await identities.prepare("CODEX", "account-a")).environment).toEqual(first.environment);
  });

  it("refuses absent, broad, relative roots and unsupported/invalid installations", async () => {
    const { identities } = await manager();
    await expect(identities.prepare("CODEX", "../escape")).rejects.toThrow();
    await expect(identities.prepare("ANTIGRAVITY", "account-a")).rejects.toThrow();
    for (const root of [undefined, "/", "relative"]) {
      await expect(
        new ProviderIdentityManager(root, {
          CODEX: process.execPath,
          CLAUDE: process.execPath,
        }).prepare("CODEX", "account-a"),
      ).rejects.toThrow();
    }
  });

  it("refuses world-readable roots without changing their permissions", async () => {
    const { root, identities } = await manager();
    await chmod(root, 0o755);
    await expect(identities.prepare("CODEX", "account-a")).rejects.toThrow("private");
  });

  it("refuses symlinked account and credential-store directories", async () => {
    const { root, identities } = await manager();
    const other = await mkdir(path.join(root, "other"), { mode: 0o700 });
    expect(other).toBeUndefined();
    await symlink(path.join(root, "other"), path.join(root, "codex-account-a"));
    await expect(identities.prepare("CODEX", "account-a")).rejects.toThrow("private");
    const second = await identities.prepare("CODEX", "account-b");
    const store = second.environment.CODEX_HOME;
    if (!store) throw new Error("Missing test store");
    await rm(store, { recursive: true });
    await symlink(path.join(root, "other"), store);
    await expect(identities.prepare("CODEX", "account-b")).rejects.toThrow("private");
  });

  it("refuses symlinked root ancestors and insecure existing account homes", async () => {
    const { root, identities } = await manager();
    await symlink(root, path.join(root, "alias"));
    await expect(
      new ProviderIdentityManager(path.join(root, "alias"), {
        CODEX: process.execPath,
        CLAUDE: process.execPath,
      }).prepare("CODEX", "account-a"),
    ).rejects.toThrow("private");
    const account = await identities.prepare("CODEX", "account-a");
    if (!account.environment.HOME) throw new Error("Missing test home");
    await chmod(account.environment.HOME, 0o770);
    await expect(identities.prepare("CODEX", "account-a")).rejects.toThrow("private");
  });

  it("blocks Claude writing before preparing any client", async () => {
    const { identities } = await manager();
    await expect(
      identities.adapter({
        role: "DEVELOPER",
        provider: "claude",
        installationId: "account-a",
        model: "configured-model",
        permissionMode: "WORKSPACE_WRITE",
      }),
    ).rejects.toThrow("confinement");
    expect(
      (
        await identities.adapter({
          role: "REVIEWER",
          provider: "claude",
          installationId: "account-a",
          model: "configured-model",
          permissionMode: "READ_ONLY",
        })
      ).name,
    ).toBe("claude");
    expect(
      (
        await identities.adapter({
          role: "DEVELOPER",
          provider: "codex",
          installationId: "account-a",
          model: "configured-model",
          permissionMode: "WORKSPACE_WRITE",
        })
      ).name,
    ).toBe("codex");
  });

  it("passes the same isolated environment to real subprocess status and device-login runners", async () => {
    const { identities } = await manager();
    const identity = await identities.prepare("CODEX", "account-a");
    // Node fixture, no official client, inference, login or credential content.
    const fixture = {
      ...identity,
      binaryArgsPrefix: [
        "-e",
        "if(process.env.WORKER_API_TOKEN || process.env.OPENAI_API_KEY) process.exit(2); console.log(process.env.CODEX_HOME)",
        "--",
      ],
    };
    const result = await runVerificationCommand("ignored", ["login", "status"], fixture);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(identity.environment.CODEX_HOME);
    const loginFixture = {
      ...identity,
      binaryArgsPrefix: [
        "-e",
        `if(process.env.CODEX_HOME !== ${JSON.stringify(identity.environment.CODEX_HOME)} || process.env.WORKER_API_TOKEN) process.exit(2); console.log('https://auth.openai.com/codex/device ABCD-EFGH')`,
        "--",
      ],
    };
    const challenges: unknown[] = [];
    const login = await runCodexDeviceLogin(
      new Date(Date.now() + 15_000).toISOString(),
      async (challenge) => {
        challenges.push(challenge);
      },
      loginFixture,
    );
    expect(login.exitCode).toBe(0);
    expect(login.challengePublished).toBe(true);
    expect(challenges).toHaveLength(1);
  });
});
