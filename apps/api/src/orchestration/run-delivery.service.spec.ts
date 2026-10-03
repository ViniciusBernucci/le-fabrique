import { createHash } from "node:crypto";
import {
  executionArtifactSchema,
  executionResultReportSchema,
  executionSpecificationSchema,
} from "@le-fabrique/contracts";
import { describe, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { RunDeliveryController } from "./run-delivery.controller";
import { RunDeliveryService } from "./run-delivery.service";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function fixture() {
  const timestamp = new Date().toISOString();
  const runId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
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
    createdAt: timestamp,
  };
  const artifact = executionArtifactSchema.parse({
    schemaVersion: 1,
    manifest: { ...core, manifestHash: hash(JSON.stringify(core)) },
    patchBase64: patch.toString("base64"),
    files: [],
  });
  const { untracked: _untracked, ...publicManifest } = artifact.manifest;
  const result = executionResultReportSchema.parse({
    schemaVersion: 1,
    workflowId: attemptId,
    status: "AWAITING_HUMAN",
    reason: "APPROVED",
    developerExecutions: 1,
    reviewerExecutions: 1,
    corrections: 0,
    checks: ["BASELINE", "POST_CHANGE"].map((phase) => ({
      phase,
      round: 0,
      name: "test",
      status: "COMPLETED",
      exitCode: 0,
      preExisting: false,
      stoppedConfirmed: true,
    })),
    snapshots: [{ ...publicManifest, untrackedFiles: 0 }],
    review: {
      schemaVersion: 1,
      verdict: "APPROVE",
      summary: "<script>untrusted</script>",
      findings: [],
    },
    diagnostic: "Ready",
    runtimeObservations: ["DEVELOPER", "REVIEWER"].map((role) => ({
      executionId: crypto.randomUUID(),
      role,
      installationId: "configured",
      provider: "codex",
      modelRequested: null,
      modelEffective: null,
      configurationVersion: 1,
      configurationObservedAt: timestamp,
      status: "COMPLETED",
      errorCode: null,
      usage: null,
      startedAt: timestamp,
      finishedAt: timestamp,
    })),
  });
  const specification = executionSpecificationSchema.parse({
    schemaVersion: 1,
    project: {
      id: projectId,
      name: "Synthetic",
      repoUrl: "https://example.test/project.git",
      baseRevision: "a".repeat(40),
      definitionVersion: 1,
      definition: {
        summary: "Project",
        externalStack: "Existing",
        instructions: "Do not deploy",
        allowedPaths: ["src"],
        forbiddenPaths: [],
        checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"] }],
        executionProfile: {
          contextSources: [{ path: "src", role: "SOURCE" }],
          approvedChecks: [{ name: "test", command: "/usr/bin/npm", args: ["test"] }],
        },
      },
    },
    ticket: {
      id: ticketId,
      version: 2,
      title: "Frozen ticket",
      objective: "Frozen objective",
      acceptanceCriteria: ["Configured criterion"],
    },
  });
  const attempt = {
    id: attemptId,
    status: "COMPLETED",
    stoppedConfirmed: true,
    fencingToken: 2,
    result,
    artifact,
    resultDigest: hash(JSON.stringify(result)),
    artifactDigest: hash(JSON.stringify(artifact)),
    checkpoint: {
      stoppedConfirmed: true,
      reason: "COMPLETED",
      baseRevision: "a".repeat(40),
      codeRevision: "a".repeat(40),
      snapshotId: artifact.manifest.snapshotId,
      patchHash: artifact.manifest.manifestHash,
    },
  };
  const run = {
    id: runId,
    ticketId,
    status: "VALIDATING",
    version: 3,
    nextFencingToken: 2,
    dispatchEventId: crypto.randomUUID(),
    createdAt: new Date(timestamp),
    updatedAt: new Date(timestamp),
    ticket: {
      id: ticketId,
      projectId,
      title: "Mutable title",
      objective: "Changed objective",
      status: "VALIDATING",
    },
    attempts: [attempt],
    approval: null as unknown,
  };
  const tx = {
    run: {
      findUnique: vi.fn(async () => run),
      update: vi.fn(async (input) => {
        Object.assign(run, input.data, { version: run.version + 1 });
        return run;
      }),
    },
    ticket: {
      update: vi.fn(async () => {
        run.ticket.status = "DONE";
      }),
    },
    outboxEvent: {
      findUnique: vi.fn(async () => ({
        eventType: "ticket.ready.v1",
        payload: { executionSpecification: specification },
      })),
    },
  };
  const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
  const service = new RunDeliveryService(prisma as never);
  return { service, run, attempt, tx, prisma, specification };
}
describe("RunDeliveryService", () => {
  it("requires successful documentation evidence bound to the final snapshot for new policies", async () => {
    const f = fixture();
    const profile = f.specification.project.definition.executionProfile;
    if (!profile) throw new Error("fixture profile required");
    profile.documentation = {
      requiredFiles: ["src/README.md"],
      reportPath: "src/README.md",
      requiredSections: ["Checks"],
    };
    await expect(f.service.get(f.run.id)).resolves.toMatchObject({
      delivery: null,
      reason: "EVIDENCE_MISMATCH",
    });
    f.attempt.result.documentation = {
      status: "PASS",
      snapshotHash: f.attempt.artifact.manifest.manifestHash,
      files: [{ path: "src/README.md", sha256: "c".repeat(64) }],
      findings: [],
    };
    f.attempt.resultDigest = hash(JSON.stringify(f.attempt.result));
    expect((await f.service.get(f.run.id)).delivery?.documentMarkdown).toContain(
      "Documentação técnica no projeto",
    );
    f.attempt.result.documentation.snapshotHash = "d".repeat(64);
    f.attempt.resultDigest = hash(JSON.stringify(f.attempt.result));
    await expect(f.service.get(f.run.id)).resolves.toMatchObject({
      delivery: null,
      reason: "EVIDENCE_MISMATCH",
    });
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });

  it("accepts the frozen original specification on an explicit resume event", async () => {
    const f = fixture();
    f.tx.outboxEvent.findUnique.mockResolvedValue({
      eventType: "run.resume.v1",
      payload: { executionSpecification: f.specification },
    });
    await expect(f.service.get(f.run.id)).resolves.toMatchObject({
      reason: null,
      accepted: false,
      delivery: expect.any(Object),
    });
  });
  it("generates bound Markdown from READY rather than mutable ticket data", async () => {
    const f = fixture();
    const state = await f.service.get(f.run.id);
    expect(state.delivery?.documentMarkdown).toContain("Frozen objective");
    expect(state.delivery?.documentMarkdown).not.toContain("Changed objective");
    expect(state.delivery?.documentMarkdown).toContain("&lt;script&gt;");
    expect(state.delivery?.documentMarkdown).not.toContain("<script>");
    expect(state.delivery?.documentMarkdown).toContain("desconhecido");
    expect(state.delivery?.documentMarkdown).toContain("não altera a documentação técnica");
    expect(hash(state.delivery?.documentMarkdown ?? "")).toBe(state.delivery?.documentDigest);
    expect(f.tx.run.update).not.toHaveBeenCalled();
  });
  it("records exact explicit acceptance atomically and remains idempotent", async () => {
    const f = fixture();
    const state = await f.service.get(f.run.id);
    if (!state.delivery) throw new Error("missing fixture delivery");
    const input = {
      expectedVersion: 3,
      attemptId: f.attempt.id,
      deliveryDigest: state.delivery.deliveryDigest,
    };
    await expect(f.service.approve(f.run.id, input)).resolves.toMatchObject({
      status: "DONE",
      version: 4,
    });
    await expect(f.service.approve(f.run.id, input)).resolves.toMatchObject({
      status: "DONE",
      version: 4,
    });
    expect(f.tx.run.update).toHaveBeenCalledTimes(1);
    expect(f.tx.ticket.update).toHaveBeenCalledTimes(1);
    expect(f.run.approval).toMatchObject({
      delivery: state.delivery,
      acceptedAt: expect.any(String),
    });
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });
  it.each(["version", "attempt", "digest"])("rejects stale %s before mutations", async (mode) => {
    const f = fixture();
    const state = await f.service.get(f.run.id);
    if (!state.delivery) throw new Error("missing fixture delivery");
    const input = {
      expectedVersion: mode === "version" ? 2 : 3,
      attemptId: mode === "attempt" ? crypto.randomUUID() : f.attempt.id,
      deliveryDigest: mode === "digest" ? "f".repeat(64) : state.delivery.deliveryDigest,
    };
    await expect(f.service.approve(f.run.id, input)).rejects.toThrow();
    expect(f.tx.run.update).not.toHaveBeenCalled();
    expect(f.tx.ticket.update).not.toHaveBeenCalled();
  });
  it.each(["result", "artifact", "stop", "check", "calls", "checkpoint", "specification"])(
    "blocks mismatched %s evidence",
    async (mode) => {
      const f = fixture();
      if (mode === "result") f.attempt.resultDigest = "f".repeat(64);
      if (mode === "artifact") f.attempt.artifactDigest = "f".repeat(64);
      if (mode === "stop") f.attempt.stoppedConfirmed = false;
      if (mode === "check") {
        f.attempt.result.checks[1].exitCode = 1;
        f.attempt.resultDigest = hash(JSON.stringify(f.attempt.result));
      }
      if (mode === "calls") {
        f.attempt.result.runtimeObservations = [];
        f.attempt.resultDigest = hash(JSON.stringify(f.attempt.result));
      }
      if (mode === "checkpoint") f.attempt.checkpoint.patchHash = "f".repeat(64);
      if (mode === "specification") f.specification.ticket.id = crypto.randomUUID();
      await expect(f.service.get(f.run.id)).resolves.toMatchObject({
        delivery: null,
        accepted: false,
        reason: "EVIDENCE_MISMATCH",
      });
      expect(f.tx.run.update).not.toHaveBeenCalled();
    },
  );
  it("allows a documented preexisting check failure but not a false preexisting claim", async () => {
    const f = fixture();
    f.attempt.result.checks[1].exitCode = 1;
    f.attempt.result.checks[1].preExisting = true;
    f.attempt.resultDigest = hash(JSON.stringify(f.attempt.result));
    expect((await f.service.get(f.run.id)).delivery).toBeNull();
    f.attempt.result.checks[0].exitCode = 1;
    f.attempt.resultDigest = hash(JSON.stringify(f.attempt.result));
    expect((await f.service.get(f.run.id)).delivery).not.toBeNull();
  });
  it("invalidates old acceptance for a different current artifact", async () => {
    const f = fixture();
    const state = await f.service.get(f.run.id);
    if (!state.delivery) throw new Error("missing fixture delivery");
    await f.service.approve(f.run.id, {
      expectedVersion: 3,
      attemptId: f.attempt.id,
      deliveryDigest: state.delivery.deliveryDigest,
    });
    f.attempt.artifactDigest = "f".repeat(64);
    await expect(f.service.get(f.run.id)).resolves.toMatchObject({
      delivery: null,
      accepted: false,
    });
  });
  it("keeps approval guarded and caller extra fields invalid", () => {
    expect(Reflect.getMetadata("__guards__", RunDeliveryController)).toEqual([AdminAuthGuard]);
    const controller = new RunDeliveryController({} as never);
    expect(() =>
      controller.approve(crypto.randomUUID(), {
        expectedVersion: 1,
        attemptId: crypto.randomUUID(),
        deliveryDigest: "a".repeat(64),
        token: "forbidden",
      }),
    ).toThrow("Invalid delivery approval payload");
  });

  it("does not trust unchanged digest columns if accepted bytes changed", async () => {
    const f = fixture();
    const state = await f.service.get(f.run.id);
    if (!state.delivery) throw new Error("missing fixture delivery");
    await f.service.approve(f.run.id, {
      expectedVersion: 3,
      attemptId: f.attempt.id,
      deliveryDigest: state.delivery.deliveryDigest,
    });
    f.attempt.result.diagnostic = "Changed after acceptance";
    await expect(f.service.get(f.run.id)).resolves.toMatchObject({
      delivery: null,
      accepted: false,
      reason: "EVIDENCE_MISMATCH",
    });
  });
});
