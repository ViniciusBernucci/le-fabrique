import {
  factorySchedulingStateSchema,
  updateFactorySchedulingSchema,
} from "@le-fabrique/contracts";
import { ConflictException, HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { FactorySchedulingController } from "./factory-scheduling.controller";
import { FactorySchedulingService } from "./factory-scheduling.service";
import { factorySchedulingPause, requireFactoryScheduling } from "./factory-scheduling-guard";
import { OutboxDispatcher } from "./outbox-dispatcher";

it("requires an initialized unpaused scheduling row and never treats missing state as enabled", async () => {
  const transaction = { $queryRaw: vi.fn().mockResolvedValue([{ paused: true }]) };
  try {
    await requireFactoryScheduling(transaction as never);
    throw new Error("expected pause");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(423);
  }
  transaction.$queryRaw.mockResolvedValue([]);
  await expect(factorySchedulingPause(transaction as never)).rejects.toBeInstanceOf(
    ConflictException,
  );
  transaction.$queryRaw.mockResolvedValue([{ paused: false }]);
  await expect(requireFactoryScheduling(transaction as never)).resolves.toBeUndefined();
  expect(transaction.$queryRaw.mock.calls[0]?.[0].join("")).toContain("FOR SHARE");
});

it("uses optimistic version update and refuses conflicts without rewriting intent", async () => {
  const now = new Date();
  const transaction = {
    factoryOperation: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ paused: true, version: 3, updatedAt: now }),
    },
  };
  const prisma = { $transaction: vi.fn((fn) => fn(transaction)) };
  const service = new FactorySchedulingService(prisma as never);
  expect(await service.update({ paused: true, expectedVersion: 2 })).toEqual({
    paused: true,
    version: 3,
    updatedAt: now.toISOString(),
  });
  expect(transaction.factoryOperation.updateMany).toHaveBeenCalledWith({
    where: { id: "factory", version: 2 },
    data: { paused: true, version: { increment: 1 } },
  });
  transaction.factoryOperation.updateMany.mockResolvedValue({ count: 0 });
  await expect(service.update({ paused: false, expectedVersion: 2 })).rejects.toBeInstanceOf(
    ConflictException,
  );
  expect(transaction.factoryOperation.findUniqueOrThrow).toHaveBeenCalledOnce();
});

it.each([true, null])(
  "keeps queued intent pending and pauses Redis when scheduling=%s",
  async (state) => {
    const prisma = {
      factoryOperation: {
        findUnique: vi.fn().mockResolvedValue(state === null ? null : { paused: true }),
      },
      outboxEvent: { findMany: vi.fn(), updateMany: vi.fn() },
    };
    const queue = {
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn(),
      add: vi.fn(),
      close: vi.fn(),
    };
    expect(await new OutboxDispatcher(prisma as never, queue).dispatchOnce()).toBe(0);
    expect(queue.pause).toHaveBeenCalledOnce();
    expect(queue.resume).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
  },
);

it("does not publish/consume retry budget when Redis pause synchronization fails", async () => {
  const prisma = {
    factoryOperation: { findUnique: vi.fn().mockResolvedValue({ paused: true }) },
    outboxEvent: { findMany: vi.fn() },
  };
  const queue = {
    pause: vi.fn().mockRejectedValue(new Error("synthetic Redis failure")),
    resume: vi.fn(),
    add: vi.fn(),
    close: vi.fn(),
  };
  expect(await new OutboxDispatcher(prisma as never, queue).dispatchOnce()).toBe(0);
  expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled();
});

it("never overlaps dispatcher pause/resume/publication cycles", async () => {
  let finish: ((value: { paused: boolean }) => void) | undefined;
  const prisma = {
    factoryOperation: {
      findUnique: vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    },
    outboxEvent: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const queue = { pause: vi.fn(), resume: vi.fn(), add: vi.fn(), close: vi.fn() };
  const dispatcher = new OutboxDispatcher(prisma as never, queue);
  const pending = dispatcher.dispatchOnce();
  expect(await dispatcher.dispatchOnce()).toBe(0);
  expect(prisma.factoryOperation.findUnique).toHaveBeenCalledOnce();
  finish?.({ paused: false });
  await pending;
  expect(queue.resume).toHaveBeenCalledOnce();
});

it("authenticates scheduling HTTP and rejects unversioned or extra usage options", async () => {
  const token = "synthetic-factory-pause-administrator-32-chars";
  const service = {
    update: vi
      .fn()
      .mockResolvedValue({ paused: true, version: 2, updatedAt: new Date().toISOString() }),
  };
  const module = await Test.createTestingModule({
    controllers: [FactorySchedulingController],
    providers: [
      AdminAuthGuard,
      { provide: ConfigService, useValue: { getOrThrow: () => token } },
      { provide: FactorySchedulingService, useValue: service },
    ],
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const url = `${await app.getUrl()}/operation/scheduling`;
    expect((await fetch(url, { method: "PUT" })).status).toBe(401);
    expect(service.update).not.toHaveBeenCalled();
    for (const body of [
      { paused: true },
      { paused: false, expectedVersion: 1, extraUsage: true },
    ]) {
      expect(
        (
          await fetch(url, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        ).status,
      ).toBe(400);
    }
    const response = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paused: true, expectedVersion: 1 }),
    });
    expect(response.status).toBe(200);
    expect(factorySchedulingStateSchema.parse(await response.json()).paused).toBe(true);
    expect(
      updateFactorySchedulingSchema.safeParse({ paused: "false", expectedVersion: 1 }).success,
    ).toBe(false);
  } finally {
    await app.close();
  }
});
