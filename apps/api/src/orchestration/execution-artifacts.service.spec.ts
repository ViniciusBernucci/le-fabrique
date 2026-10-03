import { createHash } from "node:crypto";
import { executionArtifactSchema, executionResultReportSchema } from "@le-fabrique/contracts";
import { describe, expect, it, vi } from "vitest";
import { ExecutionArtifactsService } from "./execution-artifacts.service";
import { WorkerExecutionResultsController } from "./execution-results.controller";

const attemptId = crypto.randomUUID();
const workerId = crypto.randomUUID();
const runId = crypto.randomUUID();
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function fixture() {
  const patch = Buffer.from("diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n");
  const core = {
    schemaVersion: 1,
    snapshotId: crypto.randomUUID(),
    baseRevision: "a".repeat(40),
    headRevision: "a".repeat(40),
    patchBytes: patch.length,
    patchSha256: hash(patch),
    untracked: [],
    totalArtifactBytes: patch.length,
    createdAt: new Date().toISOString(),
  };
  const artifact = executionArtifactSchema.parse({
    schemaVersion: 1,
    manifest: { ...core, manifestHash: hash(Buffer.from(JSON.stringify(core))) },
    patchBase64: patch.toString("base64"),
    files: [],
  });
  const { untracked: _untracked, ...publicManifest } = artifact.manifest;
  const result = executionResultReportSchema.parse({
    schemaVersion: 1,
    workflowId: attemptId,
    status: "FAILED",
    reason: "REVIEW_INVALID",
    developerExecutions: 1,
    reviewerExecutions: 1,
    corrections: 0,
    checks: [],
    snapshots: [{ ...publicManifest, untrackedFiles: 0 }],
    review: null,
    diagnostic: "review failed",
    runtimeObservations: [],
  });
  const attempt = {
    id: attemptId,
    runId,
    workerId,
    fencingToken: 2,
    run: { nextFencingToken: 2 },
    result,
    artifact,
    artifactDigest: null as string | null,
  };
  const tx = { attempt: { findUnique: vi.fn(async () => attempt), update: vi.fn() } };
  const prisma = {
    $transaction: vi.fn((callback) => callback(tx)),
    attempt: { findFirst: vi.fn(async () => attempt) },
  };
  return {
    artifact,
    attempt,
    tx,
    prisma,
    service: new ExecutionArtifactsService(prisma as never),
    input: { workerId, fencingToken: 2, artifact },
  };
}
describe("ExecutionArtifactsService", () => {
  it("writes only bounded artifact evidence with current owner/fence", async () => {
    const f = fixture();
    const receipt = await f.service.report(attemptId, f.input);
    expect(receipt.attemptId).toBe(attemptId);
    expect(Object.keys(f.tx.attempt.update.mock.calls[0][0].data)).toEqual([
      "artifact",
      "artifactDigest",
    ]);
  });
  it("keeps same digest idempotent and rejects divergent content", async () => {
    const f = fixture();
    f.attempt.artifactDigest = hash(Buffer.from(JSON.stringify(f.artifact)));
    await f.service.report(attemptId, f.input);
    expect(f.tx.attempt.update).not.toHaveBeenCalled();
    f.attempt.artifactDigest = "f".repeat(64);
    await expect(f.service.report(attemptId, f.input)).rejects.toThrow("immutable");
  });
  it.each(["owner", "fence", "snapshot", "result"])(
    "rejects %s mismatch without write",
    async (mode) => {
      const f = fixture();
      if (mode === "owner") f.attempt.workerId = crypto.randomUUID();
      if (mode === "fence") f.attempt.run.nextFencingToken = 3;
      if (mode === "snapshot") f.attempt.result.snapshots[0].snapshotId = crypto.randomUUID();
      if (mode === "result") f.attempt.result.workflowId = crypto.randomUUID();
      await expect(f.service.report(attemptId, f.input)).rejects.toThrow();
      expect(f.tx.attempt.update).not.toHaveBeenCalled();
    },
  );
  it("rejects corrupt bundle before transaction", async () => {
    const f = fixture();
    f.artifact.patchBase64 = Buffer.from("corrupt").toString("base64");
    await expect(f.service.report(attemptId, f.input)).rejects.toThrow("integrity mismatch");
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("constrains reads to requested run and validates stored bytes", async () => {
    const f = fixture();
    await expect(f.service.get(runId, attemptId)).resolves.toEqual({ artifact: f.artifact });
    expect(f.prisma.attempt.findFirst).toHaveBeenCalledWith({
      where: { id: attemptId, runId },
      select: { artifact: true },
    });
    f.artifact.patchBase64 = "";
    await expect(f.service.get(runId, attemptId)).rejects.toThrow("integrity mismatch");
  });
  it("rejects private fields at worker controller boundary", () => {
    const f = fixture();
    const controller = new WorkerExecutionResultsController({} as never, f.service);
    expect(() =>
      controller.reportArtifact(attemptId, {
        ...f.input,
        artifact: { ...f.artifact, artifactPath: "/private" },
      }),
    ).toThrow("Invalid execution artifact payload");
  });
});
