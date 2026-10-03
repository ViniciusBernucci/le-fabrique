import { createHash } from "node:crypto";
import {
  executionArtifactSchema,
  executionResultReportSchema,
  orchestrationReconcileRequestSchema,
} from "@le-fabrique/contracts";
import { describe, expect, it, vi } from "vitest";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { OrchestrationController } from "./orchestration.controller";
import { OrchestrationService } from "./orchestration.service";

const attemptId = crypto.randomUUID();
const workerId = crypto.randomUUID();
const runId = crypto.randomUUID();
const input = { workerId, fencingToken: 2 };
function fixture() {
  const attempt = {
    id: attemptId,
    runId,
    workerId,
    fencingToken: 2,
    stoppedConfirmed: true,
    status: "STOPPED",
    result: null as unknown,
    resultDigest: null as string | null,
    run: { id: runId, ticketId: crypto.randomUUID(), nextFencingToken: 2, status: "RUNNING" },
  };
  const checkpoint = {
    stoppedConfirmed: true,
    reason: "FAILED",
    snapshotId: null as string | null,
    patchHash: null as string | null,
    baseRevision: "a".repeat(40),
    codeRevision: "a".repeat(40),
  };
  const tx = {
    attempt: { findUnique: vi.fn(async () => attempt), update: vi.fn() },
    checkpoint: { findUnique: vi.fn(async () => checkpoint), create: vi.fn() },
    run: { update: vi.fn() },
    ticket: { update: vi.fn() },
  };
  const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
  return { attempt, checkpoint, tx, prisma, service: new OrchestrationService(prisma as never) };
}
function approve(f: ReturnType<typeof fixture>) {
  const snapshot = {
    schemaVersion: 1,
    snapshotId: crypto.randomUUID(),
    baseRevision: "a".repeat(40),
    headRevision: "b".repeat(40),
    patchBytes: 1,
    patchSha256: "c".repeat(64),
    untrackedFiles: 0,
    totalArtifactBytes: 1,
    createdAt: new Date().toISOString(),
    manifestHash: "d".repeat(64),
  };
  const report = executionResultReportSchema.parse({
    schemaVersion: 1,
    workflowId: attemptId,
    status: "AWAITING_HUMAN",
    reason: "APPROVED",
    developerExecutions: 1,
    reviewerExecutions: 1,
    corrections: 0,
    checks: [],
    snapshots: [snapshot],
    review: { schemaVersion: 1, verdict: "APPROVE", summary: "Reviewed", findings: [] },
    diagnostic: "Ready",
    runtimeObservations: [],
  });
  f.attempt.result = report;
  f.attempt.resultDigest = createHash("sha256").update(JSON.stringify(report)).digest("hex");
  Object.assign(f.checkpoint, {
    reason: "COMPLETED",
    snapshotId: snapshot.snapshotId,
    patchHash: snapshot.manifestHash,
    codeRevision: snapshot.headRevision,
  });
}
describe("stopped checkpoint reconciliation", () => {
  it("reconciles stopped provider waiting only with matching persisted report", async () => {
    const f = fixture();
    approve(f);
    f.checkpoint.reason = "WAITING_PROVIDER";
    const report = executionResultReportSchema.parse({
      ...(f.attempt.result as object),
      status: "WAITING_PROVIDER",
      reason: "PROVIDER_UNAVAILABLE",
      review: null,
    });
    f.attempt.result = report;
    f.attempt.resultDigest = createHash("sha256").update(JSON.stringify(report)).digest("hex");
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "WAITING_PROVIDER", stoppedConfirmed: true },
    });
    expect(f.tx.attempt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "STOPPED" }) }),
    );
  });
  it("recovers blocked approved work only with exact result, snapshot and artifact", async () => {
    const f = fixture();
    approve(f);
    f.attempt.run.status = "BLOCKED_RECOVERY";
    const core = {
      schemaVersion: 1,
      snapshotId: crypto.randomUUID(),
      baseRevision: "a".repeat(40),
      headRevision: "a".repeat(40),
      patchBytes: 0,
      patchSha256: createHash("sha256").update("").digest("hex"),
      untracked: [],
      totalArtifactBytes: 0,
      createdAt: new Date().toISOString(),
    };
    const artifact = executionArtifactSchema.parse({
      schemaVersion: 1,
      manifest: {
        ...core,
        manifestHash: createHash("sha256").update(JSON.stringify(core)).digest("hex"),
      },
      patchBase64: "",
      files: [],
    });
    const { untracked: _untracked, ...manifest } = artifact.manifest;
    const report = executionResultReportSchema.parse({
      ...(f.attempt.result as object),
      snapshots: [{ ...manifest, untrackedFiles: 0 }],
    });
    Object.assign(f.attempt, {
      result: report,
      resultDigest: createHash("sha256").update(JSON.stringify(report)).digest("hex"),
      artifact,
      artifactDigest: createHash("sha256").update(JSON.stringify(artifact)).digest("hex"),
    });
    Object.assign(f.checkpoint, {
      baseRevision: manifest.baseRevision,
      codeRevision: manifest.headRevision,
      snapshotId: manifest.snapshotId,
      patchHash: manifest.manifestHash,
    });
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "VALIDATING", stoppedConfirmed: true },
    });
  });
  it("can reconcile blocked setup only after persisted stop proof", async () => {
    const f = fixture();
    f.attempt.run.status = "BLOCKED_RECOVERY";
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "FAILED" },
    });
  });
  it("keeps a blocked unknown writer blocked regardless of expired authority", async () => {
    const f = fixture();
    f.attempt.run.status = "BLOCKED_RECOVERY";
    f.attempt.stoppedConfirmed = false;
    await expect(f.service.reconcile(attemptId, input)).resolves.toEqual({ state: null });
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });
  it("cannot directly complete blocked state or reconcile its snapshot without verified artifact", async () => {
    const f = fixture();
    approve(f);
    f.attempt.run.status = "BLOCKED_RECOVERY";
    await expect(
      f.service.complete(attemptId, { ...input, outcome: "VALIDATING" }),
    ).rejects.toThrow("cannot rewrite");
    await expect(f.service.reconcile(attemptId, input)).rejects.toThrow();
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });
  it("reconciles manual pause from the exact persisted report", async () => {
    const f = fixture();
    approve(f);
    const report = executionResultReportSchema.parse({
      ...(f.attempt.result as object),
      status: "PAUSED",
      reason: "OPERATOR_PAUSED",
    });
    f.attempt.result = report;
    f.attempt.resultDigest = createHash("sha256").update(JSON.stringify(report)).digest("hex");
    f.checkpoint.reason = "OPERATOR_PAUSED";
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "PAUSED" },
    });
    expect(f.tx.run.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ controlAction: null }) }),
    );
  });
  it("reconciles a pause before workflow materialization without inventing a report", async () => {
    const f = fixture();
    f.checkpoint.reason = "OPERATOR_PAUSED";
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "PAUSED" },
    });
  });
  it("finishes a failed setup from persisted stop proof in a serializable transaction", async () => {
    const f = fixture();
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "FAILED", stoppedConfirmed: true },
    });
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(f.tx.checkpoint.create).not.toHaveBeenCalled();
  });
  it("recovers approved report/checkpoint as VALIDATING, not DONE", async () => {
    const f = fixture();
    approve(f);
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "VALIDATING" },
    });
  });
  it.each(["attempt", "checkpoint", "progress"])("does not infer stop from %s", async (mode) => {
    const f = fixture();
    if (mode === "attempt") f.attempt.stoppedConfirmed = false;
    if (mode === "checkpoint") f.checkpoint.stoppedConfirmed = false;
    if (mode === "progress") f.checkpoint.reason = "PROGRESS";
    await expect(f.service.reconcile(attemptId, input)).resolves.toEqual({ state: null });
    expect(f.tx.attempt.update).not.toHaveBeenCalled();
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });
  it("cannot recover success without its persisted report", async () => {
    const f = fixture();
    f.checkpoint.reason = "COMPLETED";
    await expect(f.service.reconcile(attemptId, input)).rejects.toThrow("valid persisted result");
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });
  it.each(["digest", "snapshot", "owner", "fence"])(
    "rejects inconsistent %s without mutation",
    async (mode) => {
      const f = fixture();
      approve(f);
      if (mode === "digest") f.attempt.resultDigest = "f".repeat(64);
      if (mode === "snapshot") f.checkpoint.snapshotId = crypto.randomUUID();
      if (mode === "owner") f.attempt.workerId = crypto.randomUUID();
      if (mode === "fence") f.attempt.run.nextFencingToken = 3;
      await expect(f.service.reconcile(attemptId, input)).rejects.toThrow();
      expect(f.tx.run.update).not.toHaveBeenCalled();
    },
  );
  it("does not duplicate terminal mutations on replay", async () => {
    const f = fixture();
    f.attempt.status = "FAILED";
    f.attempt.run.status = "FAILED";
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "FAILED" },
    });
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });
  it.each(["DONE", "AWAITING_HUMAN", "CANCELLED"])("cannot regress %s", async (status) => {
    const f = fixture();
    f.attempt.status = "COMPLETED";
    f.attempt.run.status = status;
    await expect(f.service.complete(attemptId, { ...input, outcome: "FAILED" })).rejects.toThrow(
      "cannot rewrite",
    );
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });
  it("protects endpoint and rejects caller-chosen outcome/stop", async () => {
    expect(Reflect.getMetadata("__guards__", OrchestrationController)).toEqual([WorkerAuthGuard]);
    expect(
      orchestrationReconcileRequestSchema.safeParse({
        ...input,
        outcome: "VALIDATING",
        stoppedConfirmed: true,
      }).success,
    ).toBe(false);
    const controller = new OrchestrationController({ reconcile: vi.fn() } as never);
    await expect(
      controller.reconcile(attemptId, { ...input, outcome: "VALIDATING" }),
    ).rejects.toThrow("Invalid orchestration payload");
  });

  it("reconciles cancelled report/snapshot without false validation", async () => {
    const f = fixture();
    approve(f);
    const result = executionResultReportSchema.parse({
      ...(f.attempt.result as object),
      status: "CANCELLED",
      reason: "INTERRUPTED",
    });
    f.attempt.result = result;
    f.attempt.resultDigest = createHash("sha256").update(JSON.stringify(result)).digest("hex");
    f.checkpoint.reason = "CANCELLED";
    await expect(f.service.reconcile(attemptId, input)).resolves.toMatchObject({
      state: { status: "CANCELLED" },
    });
  });
});
