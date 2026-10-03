import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrchestrationService } from "./orchestration.service";

const workerId = "00000000-0000-4000-8000-000000000001";
const ticketId = "00000000-0000-4000-8000-000000000002";
const eventId = "00000000-0000-4000-8000-000000000003";
const runId = "00000000-0000-4000-8000-000000000004";
const attemptId = "00000000-0000-4000-8000-000000000005";
const projectId = "00000000-0000-4000-8000-000000000006";
const now = new Date("2026-09-30T12:00:00.000Z");

beforeEach(() => vi.useFakeTimers({ now }));
afterEach(() => vi.useRealTimers());

function claimInput() {
  return {
    schemaVersion: 1 as const,
    eventId,
    ticketId,
    projectId,
    ticketVersion: 2,
    baseRevision: "a".repeat(40),
    workerId,
    leaseDurationMs: 90_000,
  };
}

describe("OrchestrationService", () => {
  it("returns the existing claim for idempotent delivery by the same worker", async () => {
    const active = {
      id: attemptId,
      runId,
      workerId,
      sequence: 1,
      fencingToken: 1,
      status: "RUNNING",
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      stoppedConfirmed: false,
      startedAt: now,
      completedAt: null,
    };
    const transaction = {
      workerIdentity: { findUnique: vi.fn().mockResolvedValue({ status: "ONLINE" }) },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({ id: ticketId, projectId, status: "RUNNING" }),
      },
      run: { findUnique: vi.fn().mockResolvedValue({ id: runId, ticketId, status: "RUNNING" }) },
      attempt: { findFirst: vi.fn().mockResolvedValue(active), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new OrchestrationService(prisma as never).claim(claimInput()),
    ).resolves.toMatchObject({ attemptId, fencingToken: 1, replayed: true });
    expect(transaction.attempt.create).not.toHaveBeenCalled();
  });

  it("persists BLOCKED_RECOVERY when an expired writer did not confirm stop", async () => {
    const transaction = {
      workerIdentity: { findUnique: vi.fn().mockResolvedValue({ status: "ONLINE" }) },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({ id: ticketId, projectId, status: "RUNNING" }),
        update: vi.fn(),
      },
      run: {
        findUnique: vi.fn().mockResolvedValue({ id: runId, ticketId, status: "RUNNING" }),
        update: vi.fn(),
      },
      attempt: {
        findFirst: vi.fn().mockResolvedValue({
          workerId,
          status: "RUNNING",
          leaseExpiresAt: new Date(now.getTime() - 1),
          stoppedConfirmed: false,
        }),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new OrchestrationService(prisma as never).claim(claimInput()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.run.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED_RECOVERY" }) }),
    );
    expect(transaction.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED_RECOVERY" }) }),
    );
  });

  it("replays the completed attempt without creating another writer", async () => {
    const completed = {
      id: attemptId,
      runId,
      workerId,
      sequence: 1,
      fencingToken: 1,
      status: "COMPLETED",
      leaseExpiresAt: new Date(now.getTime() - 30_000),
      stoppedConfirmed: true,
      startedAt: now,
      completedAt: now,
    };
    const transaction = {
      workerIdentity: { findUnique: vi.fn().mockResolvedValue({ status: "ONLINE" }) },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({ id: ticketId, projectId, status: "VALIDATING" }),
      },
      run: {
        findUnique: vi.fn().mockResolvedValue({ id: runId, ticketId, status: "VALIDATING" }),
      },
      attempt: { findFirst: vi.fn().mockResolvedValue(completed), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new OrchestrationService(prisma as never).claim(claimInput()),
    ).resolves.toMatchObject({ attemptId, fencingToken: 1, replayed: true });
    expect(transaction.attempt.create).not.toHaveBeenCalled();
  });

  it("replays a stopped checkpoint instead of creating an attempt during completion", async () => {
    const stopped = {
      id: attemptId,
      runId,
      workerId,
      sequence: 1,
      fencingToken: 1,
      status: "STOPPED",
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      stoppedConfirmed: true,
      startedAt: now,
      completedAt: null,
    };
    const transaction = {
      workerIdentity: { findUnique: vi.fn().mockResolvedValue({ status: "ONLINE" }) },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({ id: ticketId, projectId, status: "RUNNING" }),
      },
      run: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: runId, ticketId, status: "RUNNING", nextFencingToken: 1 }),
      },
      attempt: { findFirst: vi.fn().mockResolvedValue(stopped), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new OrchestrationService(prisma as never).claim(claimInput()),
    ).resolves.toMatchObject({ attemptId, fencingToken: 1, replayed: true });
    expect(transaction.attempt.create).not.toHaveBeenCalled();
  });

  it("returns the same terminal state when completion is repeated", async () => {
    const transaction = {
      attempt: {
        findUnique: vi.fn().mockResolvedValue({
          id: attemptId,
          runId,
          workerId,
          fencingToken: 1,
          status: "COMPLETED",
          run: { id: runId, ticketId, status: "VALIDATING", nextFencingToken: 1 },
        }),
        update: vi.fn(),
      },
      checkpoint: {
        findUnique: vi.fn().mockResolvedValue({ stoppedConfirmed: true }),
      },
      run: { update: vi.fn() },
      ticket: { update: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new OrchestrationService(prisma as never).complete(attemptId, {
        workerId,
        fencingToken: 1,
        outcome: "VALIDATING",
      }),
    ).resolves.toMatchObject({ attemptId, status: "VALIDATING", stoppedConfirmed: true });
    expect(transaction.attempt.update).not.toHaveBeenCalled();
    expect(transaction.run.update).not.toHaveBeenCalled();
    expect(transaction.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects a checkpoint carrying an obsolete fencing token", async () => {
    const transaction = {
      attempt: {
        findUnique: vi.fn().mockResolvedValue({
          id: attemptId,
          runId,
          workerId,
          fencingToken: 1,
          status: "RUNNING",
          run: { id: runId, nextFencingToken: 2 },
        }),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    await expect(
      new OrchestrationService(prisma as never).checkpoint(attemptId, {
        workerId,
        fencingToken: 1,
        baseRevision: "a".repeat(40),
        codeRevision: null,
        snapshotId: null,
        patchHash: null,
        reason: "PROGRESS",
        stoppedConfirmed: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("global writer admission", () => {
  function fixture() {
    const attempt = {
      id: attemptId,
      runId,
      workerId,
      sequence: 1,
      fencingToken: 1,
      status: "RUNNING",
      stoppedConfirmed: false,
      startedAt: now,
      completedAt: null,
      leaseExpiresAt: new Date(now.getTime() + 90_000),
    };
    const transaction = {
      workerIdentity: { findUnique: vi.fn().mockResolvedValue({ status: "ONLINE" }) },
      ticket: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: ticketId, projectId, status: "READY", version: 2 }),
        update: vi.fn(),
      },
      run: {
        findUnique: vi.fn().mockResolvedValue({ id: runId, ticketId, nextFencingToken: 0 }),
        update: vi.fn(),
      },
      attempt: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(attempt),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    return { transaction, service: new OrchestrationService(prisma as never) };
  }

  it.each(["RUNNING", "STOPPED", "FAILED", "CANCELLED"])(
    "blocks a different run with an unconfirmed %s attempt regardless of expiry or worker",
    async (status) => {
      const { transaction, service } = fixture();
      transaction.attempt.findMany.mockResolvedValue([
        {
          id: crypto.randomUUID(),
          status,
          workerId: crypto.randomUUID(),
          leaseExpiresAt: new Date(now.getTime() - 1),
          stoppedConfirmed: false,
        },
      ]);
      await expect(service.claim(claimInput())).rejects.toThrow("Global writer termination");
      expect(transaction.attempt.findMany).toHaveBeenCalledWith({
        where: { stoppedConfirmed: false },
        select: { id: true },
        take: 1,
      });
      expect(transaction.attempt.create).not.toHaveBeenCalled();
      expect(transaction.run.update).not.toHaveBeenCalled();
      expect(transaction.ticket.update).not.toHaveBeenCalled();
    },
  );

  it("admits the next writer only when no unconfirmed attempt exists globally", async () => {
    const { transaction, service } = fixture();
    await expect(service.claim(claimInput())).resolves.toMatchObject({
      replayed: false,
      fencingToken: 1,
    });
    expect(transaction.attempt.create).toHaveBeenCalledOnce();
  });

  it("maps PostgreSQL's concurrent unique exclusion to a conflict", async () => {
    const { transaction, service } = fixture();
    transaction.attempt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("synthetic concurrent writer", {
        code: "P2002",
        clientVersion: "6.12.0",
      }),
    );
    await expect(service.claim(claimInput())).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.run.update).not.toHaveBeenCalled();
    expect(transaction.ticket.update).not.toHaveBeenCalled();
  });

  it("propagates database failures without fabricating a claim", async () => {
    const { transaction, service } = fixture();
    transaction.attempt.create.mockRejectedValue(new Error("synthetic database failure"));
    await expect(service.claim(claimInput())).rejects.toThrow("synthetic database failure");
    expect(transaction.run.update).not.toHaveBeenCalled();
  });
});
