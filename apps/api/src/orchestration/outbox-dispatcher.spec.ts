import { describe, expect, it, vi } from "vitest";
import { OutboxDispatcher } from "./outbox-dispatcher";

describe("OutboxDispatcher", () => {
  it("publishes with a stable job id and marks the event once", async () => {
    const eventId = crypto.randomUUID();
    const event = {
      id: eventId,
      attempts: 0,
      payload: {
        ticketId: crypto.randomUUID(),
        projectId: crypto.randomUUID(),
        version: 2,
        baseRevision: "a".repeat(40),
      },
    };
    const prisma = {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([event]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: vi.fn().mockResolvedValue({}), close: vi.fn() };
    const dispatcher = new OutboxDispatcher(prisma as never, queue);

    await expect(dispatcher.dispatchOnce()).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      "ticket.execute.v1",
      expect.objectContaining({ schemaVersion: 1, eventId, ticketVersion: 2 }),
      { jobId: eventId, removeOnComplete: false, removeOnFail: false },
    );
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: eventId, status: "PENDING" } }),
    );
  });

  it("keeps the event pending when queue publication fails", async () => {
    const event = {
      id: crypto.randomUUID(),
      attempts: 0,
      payload: {
        ticketId: crypto.randomUUID(),
        projectId: crypto.randomUUID(),
        ticketVersion: 2,
        baseRevision: "a".repeat(40),
      },
    };
    const prisma = {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([event]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = {
      add: vi.fn().mockRejectedValue(new Error("redis unavailable")),
      close: vi.fn(),
    };

    await expect(new OutboxDispatcher(prisma as never, queue).dispatchOnce()).resolves.toBe(0);
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: event.id, status: "PENDING" },
      data: { status: "PENDING", attempts: { increment: 1 } },
    });
  });
});
