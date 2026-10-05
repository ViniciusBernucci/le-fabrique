import { describe, expect, it, vi } from "vitest";
import { GithubRepositoryVerificationService } from "./github-repository-verification.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";

const workerId = "11111111-1111-4111-8111-111111111111";
const verificationId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-10-02T10:00:00.000Z");

function connectedConfiguration() {
  const configuration = createDefaultFactoryConfiguration();
  configuration.github = {
    ...configuration.github,
    state: "CONNECTED",
    owner: "fixture-owner",
    repository: "fixture-repository",
    baseBranch: "feature/read-only",
  };
  return configuration;
}

function record(status = "PENDING") {
  return {
    id: verificationId,
    host: "github.com",
    owner: "fixture-owner",
    repository: "fixture-repository",
    baseBranch: "feature/read-only",
    status,
    workerId: status === "PENDING" ? null : workerId,
    access: null,
    observedOwner: null,
    observedRepository: null,
    defaultBranch: null,
    observedBaseBranch: null,
    isPrivate: null,
    isArchived: null,
    message: null,
    createdAt,
    startedAt: status === "PENDING" ? null : createdAt,
    completedAt: null,
  };
}

describe("GithubRepositoryVerificationService", () => {
  it("creates a snapshot and outbox event atomically only for connected settings", async () => {
    const created = record();
    const transaction = {
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: connectedConfiguration() }),
      },
      githubRepositoryVerification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    await expect(
      new GithubRepositoryVerificationService(prisma as never).request(),
    ).resolves.toMatchObject({ status: "PENDING", repository: "fixture-repository" });
    const outboxInput = transaction.outboxEvent.create.mock.calls[0]?.[0];
    expect(outboxInput.data).toMatchObject({
      eventType: "github.repository-verification.requested.v1",
      payload: {
        verificationId,
        host: "github.com",
        owner: "fixture-owner",
        repository: "fixture-repository",
        baseBranch: "feature/read-only",
      },
    });
    expect(JSON.stringify(outboxInput)).not.toMatch(/token|cookie|password/i);
  });

  it("rejects a request without connected authentication", async () => {
    const transaction = {
      factorySettings: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ configuration: createDefaultFactoryConfiguration() }),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    await expect(
      new GithubRepositoryVerificationService(prisma as never).request(),
    ).rejects.toThrow("connected");
  });

  it("stores complete readable evidence without mutating settings", async () => {
    const running = record("RUNNING");
    const completed = {
      ...running,
      status: "COMPLETED",
      access: "READABLE",
      observedOwner: "Fixture-Owner",
      observedRepository: "Fixture-Repository",
      defaultBranch: "main",
      observedBaseBranch: "feature/read-only",
      isPrivate: true,
      isArchived: false,
      message: "GitHub repository and configured base branch are readable",
      completedAt: new Date(),
    };
    const transaction = {
      githubRepositoryVerification: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(completed),
      },
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ configuration: connectedConfiguration() }),
        update: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    await expect(
      new GithubRepositoryVerificationService(prisma as never).complete(verificationId, {
        workerId,
        status: "COMPLETED",
        access: "READABLE",
        observedOwner: "Fixture-Owner",
        observedRepository: "Fixture-Repository",
        defaultBranch: "main",
        observedBaseBranch: "feature/read-only",
        isPrivate: true,
        isArchived: false,
        message: "GitHub repository and configured base branch are readable",
      }),
    ).resolves.toMatchObject({ status: "COMPLETED", access: "READABLE" });
    expect(transaction.factorySettings.update).not.toHaveBeenCalled();
  });

  it("discards observations when the target changes during execution", async () => {
    const running = record("RUNNING");
    const changed = connectedConfiguration();
    changed.github.baseBranch = "main";
    const failed = {
      ...running,
      status: "FAILED",
      access: "UNAVAILABLE",
      message: "GitHub repository configuration changed during verification",
      completedAt: new Date(),
    };
    const transaction = {
      githubRepositoryVerification: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(failed),
      },
      factorySettings: { findUnique: vi.fn().mockResolvedValue({ configuration: changed }) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    await expect(
      new GithubRepositoryVerificationService(prisma as never).complete(verificationId, {
        workerId,
        status: "COMPLETED",
        access: "READABLE",
        observedOwner: "fixture-owner",
        observedRepository: "fixture-repository",
        defaultBranch: "main",
        observedBaseBranch: "feature/read-only",
        isPrivate: true,
        isArchived: false,
        message: "GitHub repository and configured base branch are readable",
      }),
    ).resolves.toMatchObject({ status: "FAILED", access: "UNAVAILABLE" });
    expect(transaction.githubRepositoryVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observedOwner: null, observedRepository: null }),
      }),
    );
  });

  it("returns the normalized invalidation when the worker repeats the original completion", async () => {
    const invalidated = {
      ...record("RUNNING"),
      status: "FAILED",
      access: "UNAVAILABLE",
      message: "GitHub repository configuration changed during verification",
      completedAt: new Date(),
    };
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          githubRepositoryVerification: { findUnique: vi.fn().mockResolvedValue(invalidated) },
        }),
      ),
    };
    await expect(
      new GithubRepositoryVerificationService(prisma as never).complete(verificationId, {
        workerId,
        status: "COMPLETED",
        access: "READABLE",
        observedOwner: "fixture-owner",
        observedRepository: "fixture-repository",
        defaultBranch: "main",
        observedBaseBranch: "feature/read-only",
        isPrivate: true,
        isArchived: false,
        message: "GitHub repository and configured base branch are readable",
      }),
    ).resolves.toMatchObject({ status: "FAILED", access: "UNAVAILABLE" });
  });
});
