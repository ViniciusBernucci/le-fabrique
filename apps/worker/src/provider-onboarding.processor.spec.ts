import { describe, expect, it, vi } from "vitest";
import {
  extractCodexDeviceChallenge,
  processProviderOnboarding,
} from "./provider-onboarding.processor";

const job = {
  schemaVersion: 1 as const,
  eventId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  installationId: "codex-main",
  provider: "CODEX" as const,
  expiresAt: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
};

describe("provider onboarding", () => {
  it("extracts only an official HTTPS challenge", () => {
    expect(
      extractCodexDeviceChallenge(
        "Open https://auth.openai.com/device and enter TEST-CODE",
        job.expiresAt,
      ),
    ).toMatchObject({ userCode: "TEST-CODE" });
    expect(
      extractCodexDeviceChallenge(
        "Open https://malicious.example/device and enter TEST-CODE",
        job.expiresAt,
      ),
    ).toBeNull();
  });

  it("publishes the ephemeral challenge and confirms login with a status probe", async () => {
    const control = {
      startProviderOnboarding: vi.fn().mockResolvedValue({}),
      publishProviderOnboardingChallenge: vi.fn().mockResolvedValue({}),
      completeProviderOnboarding: vi.fn().mockResolvedValue({ status: "COMPLETED" }),
    };
    const runner = vi.fn(async (expiresAt, sink) => {
      await sink({
        verificationUri: "https://auth.openai.com/device",
        userCode: "TEST-CODE",
        expiresAt,
      });
      return { exitCode: 0, challengePublished: true };
    });
    const inspector = vi.fn().mockResolvedValue({ providerState: "AVAILABLE" });

    await processProviderOnboarding(job, control as never, runner, inspector);

    expect(control.startProviderOnboarding).toHaveBeenCalledWith(job.sessionId);
    expect(control.publishProviderOnboardingChallenge).toHaveBeenCalledWith(
      job.sessionId,
      expect.objectContaining({ userCode: "TEST-CODE" }),
    );
    expect(inspector).toHaveBeenCalledWith("CODEX");
    expect(control.completeProviderOnboarding).toHaveBeenCalledWith(job.sessionId, {
      status: "COMPLETED",
      providerState: "AVAILABLE",
      message: "Official Codex subscription login confirmed",
    });
  });

  it("expires without exposing client output", async () => {
    const control = {
      startProviderOnboarding: vi.fn().mockResolvedValue({}),
      completeProviderOnboarding: vi.fn().mockResolvedValue({ status: "EXPIRED" }),
    };
    const runner = vi.fn().mockRejectedValue(new Error("Onboarding session expired"));

    await processProviderOnboarding(job, control as never, runner);

    expect(control.completeProviderOnboarding).toHaveBeenCalledWith(job.sessionId, {
      status: "EXPIRED",
      providerState: "AUTH_REQUIRED",
      message: "Login window expired",
    });
  });
});
