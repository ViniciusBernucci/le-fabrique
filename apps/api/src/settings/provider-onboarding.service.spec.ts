import { describe, expect, it, vi } from "vitest";
import { ProviderOnboardingService } from "./provider-onboarding.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";

const workerId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-10-01T12:00:00.000Z");
const expiresAt = new Date(Date.now() + 8 * 60 * 1_000);

function record(status = "PENDING") {
  return {
    id: sessionId,
    installationId: "codex-default",
    provider: "CODEX",
    status,
    workerId: status === "PENDING" ? null : workerId,
    providerState: null,
    message: null,
    expiresAt,
    createdAt,
    startedAt: status === "PENDING" ? null : createdAt,
    completedAt: null,
  };
}

function enabledConfiguration() {
  const configuration = createDefaultFactoryConfiguration();
  const installation = configuration.installations.find((item) => item.id === "codex-default");
  if (!installation) throw new Error("Missing Codex fixture");
  installation.enabled = true;
  return configuration;
}

describe("ProviderOnboardingService", () => {
  it("creates session and outbox atomically without challenge data", async () => {
    const created = record();
    const transaction = {
      providerOnboardingSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: enabledConfiguration() }),
      },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ProviderOnboardingService(prisma as never, {} as never);

    await expect(service.request("codex-default")).resolves.toMatchObject({ status: "PENDING" });
    const outboxInput = transaction.outboxEvent.create.mock.calls[0]?.[0];
    expect(outboxInput.data.payload).toEqual({
      sessionId,
      installationId: "codex-default",
      provider: "CODEX",
      expiresAt: expiresAt.toISOString(),
    });
    expect(JSON.stringify(outboxInput)).not.toMatch(/userCode|verificationUri|token/i);
  });

  it("keeps the device challenge only in Redis with bounded TTL", async () => {
    const running = record("RUNNING");
    const awaiting = { ...running, status: "AWAITING_USER" };
    const update = vi.fn().mockResolvedValue(awaiting);
    const prisma = {
      providerOnboardingSession: {
        findUnique: vi.fn().mockResolvedValue(running),
        update,
      },
    };
    const redis = {
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue("OK"),
    };
    const service = new ProviderOnboardingService(prisma as never, redis as never);
    const challenge = {
      verificationUri: "https://auth.openai.com/device",
      userCode: "TEST-CODE",
      expiresAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
    };

    await service.publishChallenge(sessionId, workerId, challenge);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining(challenge) }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      `provider-onboarding:${sessionId}:challenge`,
      JSON.stringify(challenge),
      "EX",
      expect.any(Number),
    );
    const ttl = redis.set.mock.calls[0]?.[3];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(600);
  });

  it("updates observed provider state and removes the ephemeral challenge on completion", async () => {
    const running = record("AWAITING_USER");
    const completed = {
      ...running,
      status: "COMPLETED",
      providerState: "AVAILABLE",
      message: "Official Codex subscription login confirmed",
      completedAt: new Date(),
    };
    const transaction = {
      providerOnboardingSession: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(completed),
      },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: enabledConfiguration() }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const redis = {
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(1),
    };
    const service = new ProviderOnboardingService(prisma as never, redis as never);

    await service.complete(sessionId, {
      workerId,
      status: "COMPLETED",
      providerState: "AVAILABLE",
      message: "Official Codex subscription login confirmed",
    });

    expect(transaction.factorySettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configuration: expect.objectContaining({
            installations: expect.arrayContaining([
              expect.objectContaining({ id: "codex-default", state: "AVAILABLE" }),
            ]),
          }),
        }),
      }),
    );
    expect(redis.del).toHaveBeenCalledWith(`provider-onboarding:${sessionId}:challenge`);
  });
});
