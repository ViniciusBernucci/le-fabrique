import { describe, expect, it, vi } from "vitest";
import { GithubPullRequestDispatcher } from "./github-pull-request.dispatcher";

describe("GithubPullRequestDispatcher", () => {
  it("publishes only the validated approved payload with a stable id", async () => {
    const eventId = crypto.randomUUID();
    const payload = {
      requestId: crypto.randomUUID(),
      approvalDigest: "a".repeat(64),
      host: "github.com",
      owner: "fixture-owner",
      repository: "fixture-repository",
      baseBranch: "main",
      headBranch: "feature/gated-pr",
      title: "Gated PR",
      body: "Synthetic body",
      draft: true,
    };
    const prisma = {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([{ id: eventId, attempts: 0, payload }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: vi.fn().mockResolvedValue({}), close: vi.fn() };
    await expect(
      new GithubPullRequestDispatcher(prisma as never, queue).dispatchOnce(),
    ).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      "github.pull-request.create.v1",
      { schemaVersion: 1, eventId, ...payload },
      { jobId: eventId, removeOnComplete: false, removeOnFail: false },
    );
  });
});
