import { describe, expect, it, vi } from "vitest";
import {
  inspectGithub,
  processGithubVerification,
  sanitizeGithubEnvironment,
} from "./github-verification.processor";

describe("GitHub CLI verification", () => {
  it("uses fixed commands and recognizes the active authenticated account", async () => {
    const runner = vi.fn(async (_binary: string, args: readonly string[]) =>
      args.includes("--version")
        ? { exitCode: 0, stdout: "gh version 2.80.0\n", stderr: "" }
        : {
            exitCode: 0,
            stdout: JSON.stringify({
              hosts: {
                "github.com": [
                  {
                    active: true,
                    state: "success",
                    login: "private-user",
                    tokenSource: "private-token-source",
                  },
                ],
              },
            }),
            stderr: "private diagnostic",
          },
    );

    await expect(inspectGithub("github.com", runner)).resolves.toEqual({
      status: "COMPLETED",
      githubState: "CONNECTED",
      cliVersion: "gh version 2.80.0",
      message: "Authenticated GitHub CLI account observed",
    });
    expect(runner).toHaveBeenNthCalledWith(1, "gh", ["--version"]);
    expect(runner).toHaveBeenNthCalledWith(2, "gh", [
      "auth",
      "status",
      "--hostname",
      "github.com",
      "--json",
      "hosts",
    ]);
  });

  it("reports authentication required when the configured host has no active success", async () => {
    const runner = vi.fn(async (_binary: string, args: readonly string[]) =>
      args.includes("--version")
        ? { exitCode: 0, stdout: "gh version 2.80.0\n", stderr: "" }
        : {
            exitCode: 0,
            stdout: JSON.stringify({
              hosts: { "github.example.test": [{ active: false, state: "failure" }] },
            }),
            stderr: "",
          },
    );

    await expect(inspectGithub("github.example.test", runner)).resolves.toMatchObject({
      status: "COMPLETED",
      githubState: "AUTH_REQUIRED",
    });
  });

  it("fails closed on absent CLI, timeout or malformed status without returning raw output", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "gh version 2.80.0\n",
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "token=secret-value",
        stderr: "",
      });

    const result = await inspectGithub("github.com", runner);
    expect(result).toEqual({
      status: "FAILED",
      githubState: "ERROR",
      cliVersion: null,
      message: "GitHub CLI verification failed without persisted output",
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });

  it("removes inherited token variables and disables prompts", () => {
    const environment = sanitizeGithubEnvironment({
      PATH: "/fixture/bin",
      GH_TOKEN: "secret-gh",
      GITHUB_TOKEN: "secret-github",
      GH_ENTERPRISE_TOKEN: "secret-enterprise",
      GITHUB_ENTERPRISE_TOKEN: "secret-github-enterprise",
      GH_CONFIG_DIR: "/safe/service/config",
    });

    expect(environment).toEqual({
      PATH: "/fixture/bin",
      GH_CONFIG_DIR: "/safe/service/config",
      GH_PROMPT_DISABLED: "1",
    });
  });

  it("starts and completes through the authenticated worker protocol", async () => {
    const control = {
      startGithubVerification: vi.fn().mockResolvedValue({}),
      completeGithubVerification: vi.fn().mockResolvedValue({ status: "COMPLETED" }),
    };
    const runner = vi.fn(async (_binary: string, args: readonly string[]) =>
      args.includes("--version")
        ? { exitCode: 0, stdout: "gh version 2.80.0\n", stderr: "" }
        : {
            exitCode: 0,
            stdout: JSON.stringify({
              hosts: { "github.com": [{ active: true, state: "success" }] },
            }),
            stderr: "",
          },
    );
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      verificationId: crypto.randomUUID(),
      host: "github.com",
    };

    await processGithubVerification(job, control as never, runner);

    expect(control.startGithubVerification).toHaveBeenCalledWith(job.verificationId);
    expect(control.completeGithubVerification).toHaveBeenCalledWith(
      job.verificationId,
      expect.objectContaining({ githubState: "CONNECTED" }),
    );
  });
});
