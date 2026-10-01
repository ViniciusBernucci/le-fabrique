import { describe, expect, it, vi } from "vitest";
import { GithubVerificationDispatcher } from "./github-verification.dispatcher";

describe("GithubVerificationDispatcher", () => {
  it("publishes a validated job with a stable id", async () => {
    const eventId = crypto.randomUUID();
    const verificationId = crypto.randomUUID();
    const event = {
      id: eventId,
      attempts: 0,
      payload: { verificationId, host: "github.com" },
    };
    const prisma = {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([event]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: vi.fn().mockResolvedValue({}), close: vi.fn() };

    await expect(
      new GithubVerificationDispatcher(prisma as never, queue).dispatchOnce(),
    ).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      "github.verify.v1",
      { schemaVersion: 1, eventId, verificationId, host: "github.com" },
      { jobId: eventId, removeOnComplete: false, removeOnFail: false },
    );
  });
});
