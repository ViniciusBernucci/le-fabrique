import { describe, expect, it, vi } from "vitest";
import { GithubOnboardingService } from "./github-onboarding.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";

const workerId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-10-01T12:00:00.000Z");
const expiresAt = new Date(Date.now() + 8 * 60 * 1_000);

function record(status = "PENDING") {
  return {
    id: sessionId,
    host: "github.com",
    status,
    workerId: status === "PENDING" ? null : workerId,
    githubState: null,
    credentialStorage: null,
    message: null,
    expiresAt,
    createdAt,
    startedAt: status === "PENDING" ? null : createdAt,
    completedAt: null,
  };
}

function authRequiredConfiguration() {
  const configuration = createDefaultFactoryConfiguration();
  configuration.github.state = "AUTH_REQUIRED";
  return configuration;
}

describe("GithubOnboardingService", () => {
  it("creates session and outbox atomically without challenge or credential data", async () => {
    const created = record();
    const transaction = {
      githubOnboardingSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      githubVerification: { findFirst: vi.fn().mockResolvedValue(null) },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: authRequiredConfiguration() }),
      },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new GithubOnboardingService(prisma as never, {} as never);

    await expect(service.request()).resolves.toMatchObject({ status: "PENDING" });
    const outboxInput = transaction.outboxEvent.create.mock.calls[0]?.[0];
    expect(outboxInput.data.payload).toEqual({
      sessionId,
      host: "github.com",
      expiresAt: expiresAt.toISOString(),
    });
    expect(JSON.stringify(outboxInput)).not.toMatch(/userCode|verificationUri|token|credential/i);
  });

  it("keeps the host-bound device challenge only in Redis with bounded TTL", async () => {
    const running = record("RUNNING");
    const awaiting = { ...running, status: "AWAITING_USER" };
    const prisma = {
      githubOnboardingSession: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(awaiting),
      },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: authRequiredConfiguration() }),
      },
    };
    const redis = {
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue("OK"),
    };
    const service = new GithubOnboardingService(prisma as never, redis as never);
    const challenge = {
      verificationUri: "https://github.com/login/device",
      userCode: "TEST-CODE",
      expiresAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
    };

    await service.publishChallenge(sessionId, workerId, challenge);

    expect(redis.set).toHaveBeenCalledWith(
      `github-onboarding:${sessionId}:challenge`,
      JSON.stringify(challenge),
      "EX",
      expect.any(Number),
    );
    const ttl = redis.set.mock.calls[0]?.[3];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(600);
  });

  it("rejects a challenge for another host", async () => {
    const running = record("RUNNING");
    const prisma = {
      githubOnboardingSession: { findUnique: vi.fn().mockResolvedValue(running) },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: authRequiredConfiguration() }),
      },
    };
    const service = new GithubOnboardingService(prisma as never, {} as never);

    await expect(
      service.publishChallenge(sessionId, workerId, {
        verificationUri: "https://github.example.test/login/device",
        userCode: "TEST-CODE",
        expiresAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
      }),
    ).rejects.toThrow("challenge host does not match");
  });

  it("updates connected state only with the worker result and removes the challenge", async () => {
    const running = record("AWAITING_USER");
    const completed = {
      ...running,
      status: "COMPLETED",
      githubState: "CONNECTED",
      credentialStorage: "SECURE_STORE",
      message: "GitHub login confirmed with secure credential storage",
      completedAt: new Date(),
    };
    const transaction = {
      githubOnboardingSession: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(completed),
      },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: authRequiredConfiguration() }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const redis = {
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(1),
    };
    const service = new GithubOnboardingService(prisma as never, redis as never);

    await service.complete(sessionId, {
      workerId,
      status: "COMPLETED",
      githubState: "CONNECTED",
      credentialStorage: "SECURE_STORE",
      message: "GitHub login confirmed with secure credential storage",
    });

    expect(transaction.factorySettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configuration: expect.objectContaining({
            github: expect.objectContaining({ state: "CONNECTED" }),
          }),
        }),
      }),
    );
    expect(redis.del).toHaveBeenCalledWith(`github-onboarding:${sessionId}:challenge`);
  });
});
