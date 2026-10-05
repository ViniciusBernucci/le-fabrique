import { describe, expect, it, vi } from "vitest";
import { GithubPullRequestService } from "./github-pull-request.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";

const id = "22222222-2222-4222-8222-222222222222";
const workerId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-10-02T12:00:00.000Z");

function eligibleConfiguration() {
  const configuration = createDefaultFactoryConfiguration();
  configuration.github = {
    ...configuration.github,
    state: "CONNECTED",
    owner: "fixture-owner",
    repository: "fixture-repository",
    baseBranch: "main",
    pullRequestCreationEnabled: true,
  };
  return configuration;
}

function record(status = "PREPARED") {
  return {
    id,
    version: status === "PREPARED" ? 1 : 2,
    host: "github.com",
    owner: "fixture-owner",
    repository: "fixture-repository",
    baseBranch: "main",
    headBranch: "feature/gated-pr",
    title: "Gated PR",
    body: "Synthetic body",
    draft: true,
    approvalDigest: "a".repeat(64),
    status,
    workerId: status === "RUNNING" ? workerId : null,
    disposition: null,
    pullRequestNumber: null,
    pullRequestUrl: null,
    message: null,
    createdAt: now,
    approvedAt: status === "PREPARED" ? null : now,
    startedAt: status === "RUNNING" ? now : null,
    completedAt: null,
    cancelledAt: null,
  };
}

function eligibilityMocks() {
  return {
    factorySettings: {
      findUnique: vi.fn().mockResolvedValue({ configuration: eligibleConfiguration() }),
    },
    githubRepositoryVerification: { findFirst: vi.fn().mockResolvedValue({ id: "readable" }) },
  };
}

describe("GithubPullRequestService", () => {
  it("prepares immutable data without creating an outbox event", async () => {
    const prepared = record();
    const transaction = {
      ...eligibilityMocks(),
      githubPullRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => ({ ...prepared, ...data })),
      },
      outboxEvent: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const result = await new GithubPullRequestService(prisma as never).prepare({
      headBranch: "feature/gated-pr",
      title: "Gated PR",
      body: "Synthetic body",
      draft: true,
    });
    expect(result.status).toBe("PREPARED");
    expect(result.approvalDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("creates the outbox event only in the separate exact approval transaction", async () => {
    const prepared = record();
    const approved = { ...prepared, status: "APPROVED", version: 2, approvedAt: now };
    const transaction = {
      ...eligibilityMocks(),
      githubPullRequest: {
        findUnique: vi.fn().mockResolvedValue(prepared),
        update: vi.fn().mockResolvedValue(approved),
      },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    await expect(
      new GithubPullRequestService(prisma as never).approve(id, {
        expectedVersion: 1,
        approvalDigest: prepared.approvalDigest,
      }),
    ).resolves.toMatchObject({ status: "APPROVED", version: 2 });
    expect(transaction.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "github.pull-request.requested.v1" }),
      }),
    );
    expect(JSON.stringify(transaction.outboxEvent.create.mock.calls[0])).not.toMatch(
      /token|password/i,
    );
  });

  it("invalidates a successful callback when the configured target changes", async () => {
    const running = record("RUNNING");
    const changed = eligibleConfiguration();
    changed.github.repository = "other-repository";
    const failed = {
      ...running,
      status: "FAILED",
      message: "GitHub pull request target changed during execution",
      completedAt: now,
    };
    const transaction = {
      githubPullRequest: {
        findUnique: vi.fn().mockResolvedValue(running),
        update: vi.fn().mockResolvedValue(failed),
      },
      factorySettings: { findUnique: vi.fn().mockResolvedValue({ configuration: changed }) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    await expect(
      new GithubPullRequestService(prisma as never).complete(id, {
        workerId,
        status: "COMPLETED",
        disposition: "CREATED",
        pullRequestNumber: 18,
        pullRequestUrl: "https://github.com/fixture-owner/fixture-repository/pull/18",
        message: "created",
      }),
    ).resolves.toMatchObject({ status: "FAILED", pullRequestUrl: null });
  });
});
