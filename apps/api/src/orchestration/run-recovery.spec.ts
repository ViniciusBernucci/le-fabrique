import { requestRunRecoverySchema } from "@le-fabrique/contracts";
import { describe, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { OutboxDispatcher } from "./outbox-dispatcher";
import { RunRecoveryController } from "./run-recovery.controller";
import { RunRecoveryService } from "./run-recovery.service";

function fixture() {
  const run = {
    id: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    status: "BLOCKED_RECOVERY",
    version: 4,
    nextFencingToken: 2,
    dispatchEventId: crypto.randomUUID(),
  };
  const attempt = {
    id: crypto.randomUUID(),
    workerId: crypto.randomUUID(),
    fencingToken: 2,
    stoppedConfirmed: false,
    status: "RUNNING",
  };
  const original = {
    id: run.dispatchEventId,
    eventType: "ticket.ready.v1",
    payload: {
      schemaVersion: 1,
      ticketId: run.ticketId,
      projectId: crypto.randomUUID(),
      ticketVersion: 2,
      baseRevision: "a".repeat(40),
      projectDefinitionVersion: 1,
      executionSpecification: null,
    },
  };
  let recovery: { id: string; payload: unknown; eventType: string } | null = null;
  const tx = {
    run: {
      findUnique: vi.fn(async () => run),
      update: vi.fn(async () => {
        run.version++;
        return run;
      }),
    },
    attempt: { findFirst: vi.fn(async () => attempt) },
    outboxEvent: {
      findUnique: vi.fn(async ({ where }) => (where.id ? original : recovery)),
      create: vi.fn(async ({ data }) => {
        recovery = data;
        return data;
      }),
    },
  };
  const prisma = { $transaction: vi.fn((fn) => fn(tx)) };
  return {
    run,
    attempt,
    original,
    tx,
    prisma,
    service: new RunRecoveryService(prisma as never),
    input: { expectedVersion: 4, attemptId: attempt.id },
  };
}
describe("finalization recovery request", () => {
  it("creates only a versioned recovery intent, not a stop proof or writer", async () => {
    const f = fixture();
    const receipt = await f.service.request(f.run.id, f.input);
    expect(receipt.status).toBe("REQUESTED");
    expect(f.run.status).toBe("BLOCKED_RECOVERY");
    expect(f.run.nextFencingToken).toBe(2);
    expect(f.attempt.stoppedConfirmed).toBe(false);
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    await expect(f.service.request(f.run.id, f.input)).resolves.toEqual(receipt);
    expect(f.tx.outboxEvent.create).toHaveBeenCalledOnce();
    const event = f.tx.outboxEvent.create.mock.calls[0]?.[0].data;
    const dispatchPrisma = {
      factoryOperation: { findUnique: vi.fn().mockResolvedValue({ paused: false }) },
      outboxEvent: {
        findMany: vi.fn(async () => [{ ...event, attempts: 0 }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const queue = { pause: vi.fn(), resume: vi.fn(), add: vi.fn(async () => ({})), close: vi.fn() };
    await expect(new OutboxDispatcher(dispatchPrisma as never, queue).dispatchOnce()).resolves.toBe(
      1,
    );
    expect(queue.add).toHaveBeenCalledWith(
      "run.recover-finalization.v1",
      expect.objectContaining({
        mode: "FINALIZATION_ONLY",
        originalJob: expect.objectContaining({ eventId: f.original.id }),
      }),
      expect.objectContaining({ jobId: event.id }),
    );
  });
  it.each(["stale", "terminal", "attempt", "fence", "original"])(
    "refuses %s without mutation",
    async (mode) => {
      const f = fixture();
      if (mode === "stale") f.run.version++;
      if (mode === "terminal") f.run.status = "DONE";
      if (mode === "attempt") f.input.attemptId = crypto.randomUUID();
      if (mode === "fence") f.run.nextFencingToken++;
      if (mode === "original") f.original.payload.ticketId = crypto.randomUUID();
      await expect(f.service.request(f.run.id, f.input)).rejects.toThrow();
      expect(f.tx.outboxEvent.create).not.toHaveBeenCalled();
      expect(f.tx.run.update).not.toHaveBeenCalled();
    },
  );
  it("keeps payload and administrative auth strict", () => {
    const f = fixture();
    expect(requestRunRecoverySchema.safeParse({ ...f.input, stoppedConfirmed: true }).success).toBe(
      false,
    );
    expect(Reflect.getMetadata("__guards__", RunRecoveryController)).toContain(AdminAuthGuard);
    expect(() => new RunRecoveryController(f.service).request(f.run.id, {})).toThrow(
      "Invalid recovery",
    );
  });
});
