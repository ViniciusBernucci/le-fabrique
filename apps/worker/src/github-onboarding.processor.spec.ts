import { describe, expect, it, vi } from "vitest";
import {
  extractGithubDeviceChallenge,
  githubLoginArgs,
  inspectGithubCredentialStorage,
  processGithubOnboarding,
} from "./github-onboarding.processor";

describe("GitHub CLI onboarding", () => {
  it("uses only the fixed web flow without PAT, clipboard or insecure storage", () => {
    const args = githubLoginArgs("github.com");
    expect(args).toEqual([
      "auth",
      "login",
      "--hostname",
      "github.com",
      "--git-protocol",
      "https",
      "--web",
      "--skip-ssh-key",
      "--clipboard=false",
    ]);
    expect(args).not.toContain("--with-token");
    expect(args).not.toContain("--insecure-storage");
    expect(args).not.toContain("--show-token");
  });

  it("extracts only a bounded official device challenge from ANSI output", () => {
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const output = [
      "\u001b[33m!\u001b[0m First copy your one-time code: TEST-CODE",
      "Open this URL to continue in your web browser: https://github.com/login/device",
      "private diagnostic that must not be returned",
    ].join("\n");

    expect(extractGithubDeviceChallenge(output, expiresAt)).toEqual({
      verificationUri: "https://github.com/login/device",
      userCode: "TEST-CODE",
      expiresAt,
    });
  });

  it("accepts only an active success stored in keyring", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        hosts: {
          "github.com": [
            {
              active: true,
              state: "success",
              login: "private-user",
              tokenSource: "keyring",
            },
          ],
        },
      }),
      stderr: "private diagnostic",
    });

    await expect(inspectGithubCredentialStorage("github.com", runner)).resolves.toEqual({
      status: "COMPLETED",
      githubState: "CONNECTED",
      credentialStorage: "SECURE_STORE",
      message: "GitHub login confirmed with secure credential storage",
    });
    expect(runner).toHaveBeenCalledWith("gh", [
      "auth",
      "status",
      "--hostname",
      "github.com",
      "--json",
      "hosts",
    ]);
  });

  it("rejects the official plaintext fallback without exposing its path", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        hosts: {
          "github.com": [
            {
              active: true,
              state: "success",
              tokenSource: "/private/service/config/hosts.yml",
            },
          ],
        },
      }),
      stderr: "",
    });

    const result = await inspectGithubCredentialStorage("github.com", runner);
    expect(result).toEqual({
      status: "FAILED",
      githubState: "ERROR",
      credentialStorage: "PLAINTEXT_FILE",
      message: "GitHub credential store unavailable; plaintext fallback is not eligible",
    });
    expect(JSON.stringify(result)).not.toContain("/private/service");
  });

  it("fails closed for unknown token sources and malformed output", async () => {
    const unknown = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        hosts: { "github.com": [{ active: true, state: "success", tokenSource: "GH_TOKEN" }] },
      }),
      stderr: "",
    });
    const malformed = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "token=secret-value",
      stderr: "",
    });

    await expect(inspectGithubCredentialStorage("github.com", unknown)).resolves.toMatchObject({
      status: "FAILED",
      credentialStorage: "UNKNOWN",
    });
    const malformedResult = await inspectGithubCredentialStorage("github.com", malformed);
    expect(malformedResult).toMatchObject({ status: "FAILED", githubState: "ERROR" });
    expect(JSON.stringify(malformedResult)).not.toContain("secret-value");
  });

  it("publishes the challenge and completes only after secure status evidence", async () => {
    const control = {
      startGithubOnboarding: vi.fn().mockResolvedValue({}),
      publishGithubOnboardingChallenge: vi.fn().mockResolvedValue({}),
      completeGithubOnboarding: vi.fn().mockResolvedValue({ status: "COMPLETED" }),
    };
    const loginRunner = vi.fn(async (_host, expiresAt, sink) => {
      await sink({
        verificationUri: "https://github.com/login/device",
        userCode: "TEST-CODE",
        expiresAt,
      });
      return { exitCode: 0, challengePublished: true };
    });
    const inspector = vi.fn().mockResolvedValue({
      status: "COMPLETED",
      githubState: "CONNECTED",
      credentialStorage: "SECURE_STORE",
      message: "GitHub login confirmed with secure credential storage",
    });
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      host: "github.com",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };

    await processGithubOnboarding(job, control as never, loginRunner, inspector);

    expect(control.publishGithubOnboardingChallenge).toHaveBeenCalledWith(
      job.sessionId,
      expect.objectContaining({ userCode: "TEST-CODE" }),
    );
    expect(control.completeGithubOnboarding).toHaveBeenCalledWith(
      job.sessionId,
      expect.objectContaining({ status: "COMPLETED", credentialStorage: "SECURE_STORE" }),
    );
  });

  it("does not accept status evidence when the login process did not publish a challenge", async () => {
    const control = {
      startGithubOnboarding: vi.fn().mockResolvedValue({}),
      completeGithubOnboarding: vi.fn().mockResolvedValue({ status: "FAILED" }),
    };
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      host: "github.com",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };

    await processGithubOnboarding(
      job,
      control as never,
      vi.fn().mockResolvedValue({ exitCode: 0, challengePublished: false }),
      vi.fn().mockResolvedValue({
        status: "COMPLETED",
        githubState: "CONNECTED",
        credentialStorage: "SECURE_STORE",
        message: "GitHub login confirmed with secure credential storage",
      }),
    );

    expect(control.completeGithubOnboarding).toHaveBeenCalledWith(
      job.sessionId,
      expect.objectContaining({ status: "FAILED", githubState: "ERROR" }),
    );
  });
});
