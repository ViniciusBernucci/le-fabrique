import { describe, expect, it, vi } from "vitest";
import { GithubVerificationService } from "./github-verification.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";

const workerId = "11111111-1111-4111-8111-111111111111";
const verificationId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-10-01T12:00:00.000Z");

function record(status = "PENDING") {
  return {
    id: verificationId,
    host: "github.com",
    status,
    workerId: status === "PENDING" ? null : workerId,
    githubState: null,
    cliVersion: null,
    message: null,
    createdAt,
    startedAt: status === "PENDING" ? null : createdAt,
    completedAt: null,
  };
}

describe("GithubVerificationService", () => {
  it("creates a verification and outbox event atomically from the configured host", async () => {
    const created = record();
    const transaction = {
      factorySettings: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ configuration: createDefaultFactoryConfiguration() }),
      },
      githubVerification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(new GithubVerificationService(prisma as never).request()).resolves.toMatchObject({
      host: "github.com",
      status: "PENDING",
    });
    const outboxInput = transaction.outboxEvent.create.mock.calls[0]?.[0];
    expect(outboxInput.data).toMatchObject({
      eventType: "github.verification.requested.v1",
      payload: { verificationId, host: "github.com" },
    });
    expect(JSON.stringify(outboxInput)).not.toMatch(/token|cookie|password/i);
  });

  it("updates the observed GitHub state and version atomically", async () => {
    const running = record("RUNNING");
    const completed = {
      ...running,
      status: "COMPLETED",
      githubState: "CONNECTED",
      cliVersion: "gh version 2.80.0",
      message: "Authenticated GitHub CLI account observed",
      completedAt: new Date(),
    };
    const transaction = {
      githubVerification: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(completed),
      },
      factorySettings: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ configuration: createDefaultFactoryConfiguration() }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new GithubVerificationService(prisma as never);

    await service.complete(verificationId, {
      workerId,
      status: "COMPLETED",
      githubState: "CONNECTED",
      cliVersion: "gh version 2.80.0",
      message: "Authenticated GitHub CLI account observed",
    });

    expect(transaction.factorySettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configuration: expect.objectContaining({
            github: expect.objectContaining({ state: "CONNECTED" }),
          }),
          version: { increment: 1 },
        }),
      }),
    );
  });

  it("fails a stale host result without changing the current configuration", async () => {
    const running = record("RUNNING");
    const changedConfiguration = createDefaultFactoryConfiguration();
    changedConfiguration.github.host = "github.example.test";
    const failed = {
      ...running,
      status: "FAILED",
      githubState: "ERROR",
      message: "GitHub host changed during verification",
      completedAt: new Date(),
    };
    const transaction = {
      githubVerification: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(failed),
      },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: changedConfiguration }),
        update: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new GithubVerificationService(prisma as never).complete(verificationId, {
        workerId,
        status: "COMPLETED",
        githubState: "CONNECTED",
        cliVersion: "gh version 2.80.0",
        message: "Authenticated GitHub CLI account observed",
      }),
    ).resolves.toMatchObject({ status: "FAILED", githubState: "ERROR" });
    expect(transaction.factorySettings.update).not.toHaveBeenCalled();
  });
});
