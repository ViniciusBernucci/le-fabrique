import { describe, expect, it, vi } from "vitest";
import { GithubRepositoryVerificationDispatcher } from "./github-repository-verification.dispatcher";

describe("GithubRepositoryVerificationDispatcher", () => {
  it("publishes a validated read-verification job with a stable id", async () => {
    const eventId = crypto.randomUUID();
    const verificationId = crypto.randomUUID();
    const event = {
      id: eventId,
      attempts: 0,
      payload: {
        verificationId,
        host: "github.com",
        owner: "fixture-owner",
        repository: "fixture-repository",
        baseBranch: "main",
      },
    };
    const prisma = {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([event]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: vi.fn().mockResolvedValue({}), close: vi.fn() };
    await expect(
      new GithubRepositoryVerificationDispatcher(prisma as never, queue).dispatchOnce(),
    ).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      "github.repository.verify.v1",
      { schemaVersion: 1, eventId, ...event.payload },
      { jobId: eventId, removeOnComplete: false, removeOnFail: false },
    );
  });
});
