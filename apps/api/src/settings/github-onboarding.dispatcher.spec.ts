import { describe, expect, it, vi } from "vitest";
import { GithubOnboardingDispatcher } from "./github-onboarding.dispatcher";

describe("GithubOnboardingDispatcher", () => {
  it("publishes a validated job with a stable id", async () => {
    const eventId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    const event = {
      id: eventId,
      attempts: 0,
      payload: { sessionId, host: "github.com", expiresAt },
    };
    const prisma = {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([event]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: vi.fn().mockResolvedValue({}), close: vi.fn() };

    await expect(
      new GithubOnboardingDispatcher(prisma as never, queue).dispatchOnce(),
    ).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      "github.onboarding.v1",
      { schemaVersion: 1, eventId, sessionId, host: "github.com", expiresAt },
      { jobId: eventId, removeOnComplete: false, removeOnFail: false },
    );
  });
});
