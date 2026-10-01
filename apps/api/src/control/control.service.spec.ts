import { describe, expect, it, vi } from "vitest";
import { ControlService } from "./control.service";

const now = new Date("2026-09-30T12:00:00.000Z");
const draft = {
  id: "00000000-0000-4000-8000-000000000002",
  projectId: "00000000-0000-4000-8000-000000000001",
  title: "Ticket sintético",
  objective: "Validar controle",
  acceptanceCriteria: ["Outbox única"],
  status: "DRAFT",
  version: 1,
  createdAt: now,
  updatedAt: now,
  project: { baseRef: "a".repeat(40) },
};

describe("ControlService", () => {
  it("moves a ticket to READY and writes one deduplicated outbox event", async () => {
    const ready = { ...draft, status: "READY", version: 2 };
    const transaction = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue(draft),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(ready),
      },
      outboxEvent: { findUnique: vi.fn(), create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(service.markReady(draft.id, 1)).resolves.toMatchObject({
      status: "READY",
      version: 2,
    });
    expect(transaction.outboxEvent.create).toHaveBeenCalledOnce();
    expect(transaction.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deduplicationKey: `ticket:${draft.id}:ready`,
          payload: expect.objectContaining({ baseRevision: "a".repeat(40) }),
        }),
      }),
    );
  });

  it("returns an already-ready ticket when its outbox event exists", async () => {
    const ready = { ...draft, status: "READY", version: 2 };
    const transaction = {
      ticket: { findUnique: vi.fn().mockResolvedValue(ready) },
      outboxEvent: { findUnique: vi.fn().mockResolvedValue({ id: "event" }) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(service.markReady(draft.id, 1)).resolves.toMatchObject({
      status: "READY",
      version: 2,
    });
  });
});
