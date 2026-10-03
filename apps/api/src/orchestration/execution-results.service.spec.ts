import { createHash } from "node:crypto";
import { executionResultReportSchema } from "@le-fabrique/contracts";
import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import {
  RunResultsController,
  WorkerExecutionResultsController,
} from "./execution-results.controller";
import { ExecutionResultsService } from "./execution-results.service";

const attemptId = crypto.randomUUID();
const workerId = crypto.randomUUID();
function report() {
  return executionResultReportSchema.parse({
    schemaVersion: 1,
    workflowId: attemptId,
    status: "FAILED",
    reason: "RUNTIME_ROUTE_UNAVAILABLE",
    developerExecutions: 0,
    reviewerExecutions: 0,
    corrections: 0,
    checks: [],
    snapshots: [],
    review: null,
    diagnostic: "No route",
    runtimeObservations: [],
  });
}
function fixture(digest: string | null = null, fencingToken = 2) {
  const transaction = {
    attempt: {
      findUnique: vi.fn().mockResolvedValue({
        id: attemptId,
        workerId,
        fencingToken,
        run: { nextFencingToken: 2 },
        resultDigest: digest,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
  return { service: new ExecutionResultsService(prisma as never), transaction };
}
describe("ExecutionResultsService", () => {
  it("persists minimized result without changing writer stop or lease", async () => {
    const { service, transaction } = fixture();
    const receipt = await service.report(attemptId, {
      workerId,
      fencingToken: 2,
      result: report(),
    });
    expect(receipt.digest).toMatch(/^[a-f0-9]{64}$/);
    const data = transaction.attempt.update.mock.calls[0]?.[0].data;
    expect(Object.keys(data)).toEqual(["result", "resultDigest"]);
    expect(data.result).not.toHaveProperty("workspace");
  });
  it("returns the same receipt on replay without another write", async () => {
    const digest = createHash("sha256").update(JSON.stringify(report())).digest("hex");
    const { service, transaction } = fixture(digest);
    await expect(
      service.report(attemptId, { workerId, fencingToken: 2, result: report() }),
    ).resolves.toEqual({ attemptId, digest });
    expect(transaction.attempt.update).not.toHaveBeenCalled();
  });
  it("rejects changed content and stale fencing tokens", async () => {
    await expect(
      fixture("f".repeat(64)).service.report(attemptId, {
        workerId,
        fencingToken: 2,
        result: report(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    const stale = fixture(null, 1);
    await expect(
      stale.service.report(attemptId, { workerId, fencingToken: 1, result: report() }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(stale.transaction.attempt.update).not.toHaveBeenCalled();
  });
  it("rejects a result for another attempt", async () => {
    const { service, transaction } = fixture();
    await expect(
      service.report(crypto.randomUUID(), { workerId, fencingToken: 2, result: report() }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.attempt.findUnique).not.toHaveBeenCalled();
  });
  it("keeps administrative reads and worker writes under separate guards", () => {
    expect(Reflect.getMetadata("__guards__", RunResultsController)).toEqual([AdminAuthGuard]);
    expect(Reflect.getMetadata("__guards__", WorkerExecutionResultsController)).toEqual([
      WorkerAuthGuard,
    ]);
    const controller = new WorkerExecutionResultsController(
      { report: vi.fn() } as never,
      {} as never,
    );
    expect(() =>
      controller.report(attemptId, {
        workerId,
        fencingToken: 2,
        result: { ...report(), prompt: "forbidden" },
      }),
    ).toThrow("Invalid execution result payload");
  });
  it("filters and limits administrative listing", async () => {
    const projectId = crypto.randomUUID();
    const prisma = { run: { findMany: vi.fn().mockResolvedValue([]) } };
    await expect(new ExecutionResultsService(prisma as never).list(projectId)).resolves.toEqual([]);
    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticket: { projectId } }, take: 50 }),
    );
  });
});
