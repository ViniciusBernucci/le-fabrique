import type { INestApplication } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { OperationStatusController } from "./operation-status.controller";
import { OperationStatusService } from "./operation-status.service";

const now = new Date("2026-10-03T20:00:00Z");
function fixture() {
  const worker = {
    id: crypto.randomUUID(),
    name: "synthetic executor",
    status: "ONLINE",
    lastHeartbeatAt: now,
  };
  const tx = {
    workerIdentity: { findMany: vi.fn().mockResolvedValue([worker]) },
    attempt: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([{ installed: true }]),
  };
  const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
  return { worker, tx, prisma, service: new OperationStatusService(prisma as never) };
}

afterEach(() => vi.useRealTimers());
describe("factory operation observations", () => {
  it.each([
    [0, "ONLINE", "RECENT"],
    [180_000, "ONLINE", "RECENT"],
    [180_001, "ONLINE", "STALE"],
    [-1, "ONLINE", "CLOCK_SKEW"],
    [0, "OFFLINE", "OFFLINE"],
  ])("classifies heartbeat age %s and status %s conservatively", async (age, status, expected) => {
    vi.useFakeTimers({ now });
    const f = fixture();
    f.worker.lastHeartbeatAt = new Date(now.getTime() - Number(age));
    f.worker.status = String(status);
    expect((await f.service.read()).workers[0]?.heartbeatState).toBe(expected);
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
  });

  it("reports expired unresolved writers without clearing or hiding them", async () => {
    vi.useFakeTimers({ now });
    const f = fixture();
    f.tx.attempt.count.mockResolvedValue(1);
    f.tx.attempt.findMany.mockResolvedValue([
      {
        id: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        workerId: crypto.randomUUID(),
        leaseExpiresAt: new Date(now.getTime() - 1),
      },
    ]);
    const status = await f.service.read();
    expect(status.unresolvedWriterCount).toBe(1);
    expect(status.writers[0]?.leaseState).toBe("EXPIRED");
    expect(f.tx.attempt.count).toHaveBeenCalledWith({ where: { stoppedConfirmed: false } });
  });

  it("shows missing migration and empty worker registry without claiming readiness", async () => {
    const f = fixture();
    f.tx.$queryRaw.mockResolvedValue([{ installed: false }]);
    f.tx.workerIdentity.findMany.mockResolvedValue([]);
    expect(await f.service.read()).toMatchObject({ writerGuardInstalled: false, workers: [] });
  });

  it("bounds worker and writer samples without hiding the total", async () => {
    vi.useFakeTimers({ now });
    const f = fixture();
    f.tx.workerIdentity.findMany.mockResolvedValue(
      Array.from({ length: 101 }, () => ({ ...f.worker, id: crypto.randomUUID() })),
    );
    f.tx.attempt.count.mockResolvedValue(11);
    f.tx.attempt.findMany.mockResolvedValue(
      Array.from({ length: 10 }, () => ({
        id: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        workerId: crypto.randomUUID(),
        leaseExpiresAt: now,
      })),
    );
    expect(await f.service.read()).toMatchObject({
      workersTruncated: true,
      unresolvedWriterCount: 11,
    });
    expect((await f.service.read()).workers).toHaveLength(100);
  });

  it("sanitizes database failures and cannot serve a healthy cached observation", async () => {
    const f = fixture();
    await f.service.read();
    f.tx.$queryRaw.mockRejectedValue(new Error("synthetic private database detail"));
    await expect(f.service.read()).rejects.toThrow(ServiceUnavailableException);
    await expect(f.service.read()).rejects.not.toThrow("private database detail");
  });
});

it("authenticates operation HTTP before querying state and needs no project", async () => {
  const f = fixture();
  const token = "synthetic-administrator-token-with-32-characters";
  const module = await Test.createTestingModule({
    controllers: [OperationStatusController],
    providers: [
      AdminAuthGuard,
      { provide: ConfigService, useValue: { getOrThrow: () => token } },
      { provide: OperationStatusService, useValue: f.service },
    ],
  }).compile();
  const app: INestApplication = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const url = `${await app.getUrl()}/operation`;
    const denied = await fetch(url);
    expect(denied.status).toBe(401);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    const accepted = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    expect(accepted.status).toBe(200);
    const body = await accepted.json();
    expect(body.workers).toHaveLength(1);
    expect(body).not.toHaveProperty("projectId");
    expect(body).not.toHaveProperty("credentials");
  } finally {
    await app.close();
  }
});
