import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  extractProviderAuthorizationChallenge,
  runProviderAuthorizationLogin,
} from "./provider-authorization.processor";

const expiresAt = new Date(Date.now() + 60000).toISOString();
const claudeUrl =
  "https://claude.com/cai/oauth/authorize?client_id=fixture&state=fixture-state&code_challenge=fixture-pkce&response_type=code";
const googleUrl =
  "https://accounts.google.com/o/oauth2/auth?client_id=fixture&state=fixture-state&code_challenge=fixture-pkce&response_type=code";
const job = {
  schemaVersion: 1 as const,
  eventId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  installationId: "test-installation",
  expiresAt,
};
describe("official provider authorization", () => {
  it("extracts provider-bound OAuth URLs and rejects incomplete/foreign challenges", () => {
    expect(
      extractProviderAuthorizationChallenge("CLAUDE", `Open ${claudeUrl}`, expiresAt),
    ).toMatchObject({ flow: "AUTHORIZATION_CODE", provider: "CLAUDE", verificationUri: claudeUrl });
    expect(
      extractProviderAuthorizationChallenge(
        "ANTIGRAVITY",
        `\x1b]8;;${googleUrl}\x07Open Google\x1b]8;;\x07`,
        expiresAt,
      ),
    ).toMatchObject({ provider: "ANTIGRAVITY", verificationUri: googleUrl });
    expect(extractProviderAuthorizationChallenge("CLAUDE", googleUrl, expiresAt)).toBeNull();
    expect(
      extractProviderAuthorizationChallenge(
        "CLAUDE",
        "https://claude.com/cai/oauth/authorize",
        expiresAt,
      ),
    ).toBeNull();
  });
  it("delivers a one-time authorization code only to the official login subcommand", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claude-login-fixture-"));
    const fixture = path.join(root, "login.cjs");
    await writeFile(
      fixture,
      `if(process.env.OPENAI_API_KEY||process.env.ANTHROPIC_API_KEY||process.env.WORKER_API_TOKEN)process.exit(2);if(!process.argv.includes('--claudeai')||process.argv.includes('--console'))process.exit(3);console.log(${JSON.stringify(claudeUrl)});console.log('Paste code here if prompted:');require('node:readline').createInterface({input:process.stdin}).once('line',code=>process.exit(code==='fixture-code#fixture-state'?0:4));`,
    );
    const control = {
      publishProviderOnboardingChallenge: vi.fn().mockResolvedValue({}),
      takeProviderAuthorizationCode: vi.fn().mockResolvedValue("fixture-code#fixture-state"),
    };
    try {
      await expect(
        runProviderAuthorizationLogin(
          { ...job, provider: "CLAUDE" },
          {
            binaryPath: process.execPath,
            binaryArgsPrefix: [fixture],
            environment: { HOME: root, PATH: process.env.PATH },
          },
          control as never,
        ),
      ).resolves.toEqual({ exitCode: 0, challengePublished: true });
      expect(control.takeProviderAuthorizationCode).toHaveBeenCalledWith(job.sessionId);
      expect(control.publishProviderOnboardingChallenge).toHaveBeenCalledWith(
        job.sessionId,
        expect.objectContaining({ provider: "CLAUDE", flow: "AUTHORIZATION_CODE" }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("expires a waiting client without persisting raw output", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claude-expiry-"));
    const control = {
      publishProviderOnboardingChallenge: vi.fn(),
      takeProviderAuthorizationCode: vi.fn(),
    };
    try {
      await expect(
        runProviderAuthorizationLogin(
          { ...job, provider: "CLAUDE", expiresAt: new Date(Date.now() + 200).toISOString() },
          {
            binaryPath: process.execPath,
            binaryArgsPrefix: ["-e", "setInterval(()=>{},1000)", "--"],
            environment: { HOME: root, PATH: process.env.PATH },
          },
          control as never,
        ),
      ).rejects.toThrow("Onboarding session expired");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Antigravity OAuth terminal transport", () => {
  it("selects Google OAuth, submits only the returned code and confirms through a fresh metadata process", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "google-login-fixture-"));
    const fixture = path.join(root, "client.cjs");
    await writeFile(
      fixture,
      `
    const fs=require('node:fs');const path=require('node:path');const marker=path.join(process.env.HOME,'authenticated');
    if(process.env.GEMINI_API_KEY||process.env.WORKER_API_TOKEN)process.exit(9);
    if(process.argv.includes('--version')){console.log('fixture 1.0.0');process.exit(0);}
    if(process.argv.includes('models')){if(fs.existsSync(marker)){console.log('fixture-model');process.exit(0);}console.log('authentication required');process.exit(1);}
    console.log('1. Google OAuth');console.log('2. Use a Gemini API key');let stage=0;
    require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
      if(stage===0){if(line!=='')process.exit(3);stage=1;console.log(${JSON.stringify(googleUrl)});console.log('Paste the code from the browser here:');}
      else {if(line!=='fixture-code#fixture-state')process.exit(4);fs.writeFileSync(marker,'yes');console.log('Login successful');}
    });`,
    );
    const control = {
      publishProviderOnboardingChallenge: vi.fn().mockResolvedValue({}),
      takeProviderAuthorizationCode: vi.fn().mockResolvedValue("fixture-code#fixture-state"),
    };
    try {
      await expect(
        runProviderAuthorizationLogin(
          { ...job, provider: "ANTIGRAVITY" },
          {
            binaryPath: process.execPath,
            binaryArgsPrefix: [fixture],
            environment: { HOME: root, PATH: process.env.PATH, TERM: "xterm-256color" },
          },
          control as never,
        ),
      ).resolves.toEqual({ exitCode: 0, challengePublished: true });
      expect(control.publishProviderOnboardingChallenge).toHaveBeenCalledWith(
        job.sessionId,
        expect.objectContaining({ provider: "ANTIGRAVITY" }),
      );
      expect(control.takeProviderAuthorizationCode).toHaveBeenCalledTimes(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);
});
