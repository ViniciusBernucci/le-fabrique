import { describe, expect, it, vi } from "vitest";
import { inspectProvider, processProviderVerification } from "./provider-verification.processor";

describe("provider verification", () => {
  it("maps a logged-out Claude client without persisting raw output", async () => {
    const runner = vi.fn(async (_binary: string, args: readonly string[]) =>
      args.includes("--version")
        ? { exitCode: 0, stdout: "2.1.285\n", stderr: "" }
        : {
            exitCode: 0,
            stdout: JSON.stringify({ loggedIn: false, account: "private@example.test" }),
            stderr: "sensitive diagnostic",
          },
    );

    await expect(inspectProvider("CLAUDE", runner)).resolves.toEqual({
      status: "COMPLETED",
      providerState: "AUTH_REQUIRED",
      cliVersion: "2.1.285",
      observedModels: [],
      message: "Official client requires authentication",
    });
  });

  it("uses fixed Codex argv and reports an authenticated client", async () => {
    const runner = vi.fn(async (_binary: string, args: readonly string[]) => ({
      exitCode: 0,
      stdout: args.includes("--version") ? "codex-cli 0.159.2\n" : "Logged in using ChatGPT\n",
      stderr: "",
    }));

    await expect(inspectProvider("CODEX", runner)).resolves.toMatchObject({
      providerState: "AVAILABLE",
      cliVersion: "codex-cli 0.159.2",
    });
    expect(runner).toHaveBeenCalledWith("codex", ["login", "status"]);
  });

  it("starts and completes through the authenticated control client", async () => {
    const control = {
      startProviderVerification: vi.fn().mockResolvedValue({}),
      completeProviderVerification: vi.fn().mockResolvedValue({ status: "COMPLETED" }),
    };
    const runner = vi.fn().mockResolvedValue({ exitCode: 1, stdout: "", stderr: "login required" });
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      verificationId: crypto.randomUUID(),
      installationId: "codex-main",
      provider: "CODEX" as const,
    };

    await processProviderVerification(job, control as never, runner);

    expect(control.startProviderVerification).toHaveBeenCalledWith(job.verificationId);
    expect(control.completeProviderVerification).toHaveBeenCalledWith(
      job.verificationId,
      expect.objectContaining({ providerState: "AUTH_REQUIRED" }),
    );
  });

  it("does not treat a zero-exit sign-in message as an available Antigravity account", async () => {
    const runner = vi.fn(async (_binary: string, args: readonly string[]) => ({
      exitCode: 0,
      stdout: args.includes("--version") ? "1.2.14\n" : "Please sign in to view available models.",
      stderr: "",
    }));

    await expect(inspectProvider("ANTIGRAVITY", runner)).resolves.toMatchObject({
      providerState: "AUTH_REQUIRED",
      observedModels: [],
    });
  });
});
