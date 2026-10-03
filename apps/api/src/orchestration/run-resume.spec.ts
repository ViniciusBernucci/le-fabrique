import { createHash } from "node:crypto";
import {
  executionArtifactSchema,
  executionResultReportSchema,
  orchestrationJobSchema,
} from "@le-fabrique/contracts";
import { describe, expect, it, vi } from "vitest";
import { OrchestrationService } from "./orchestration.service";
import { RunResumeService } from "./run-resume.service";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fixture() {
  const timestamp = new Date();
  const ticket = {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title: "Resume configured ticket",
    status: "PAUSED",
    version: 5,
  };
  const run = {
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    ticket,
    dispatchEventId: crypto.randomUUID(),
    status: "PAUSED",
    version: 7,
    nextFencingToken: 1,
    controlAction: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const core = {
    schemaVersion: 1,
    snapshotId: crypto.randomUUID(),
    baseRevision: "a".repeat(40),
    headRevision: "a".repeat(40),
    patchBytes: 0,
    patchSha256: createHash("sha256").update("").digest("hex"),
    untracked: [],
    totalArtifactBytes: 0,
    createdAt: timestamp.toISOString(),
  };
  const artifact = executionArtifactSchema.parse({
    schemaVersion: 1,
    manifest: { ...core, manifestHash: hash(core) },
    patchBase64: "",
    files: [],
  });
  const { untracked: _files, ...manifest } = artifact.manifest;
  const attempt = {
    id: crypto.randomUUID(),
    runId: run.id,
    workerId: crypto.randomUUID(),
    fencingToken: 1,
    sequence: 1,
    status: "STOPPED",
    stoppedConfirmed: true,
    leaseExpiresAt: new Date(Date.now() - 1000),
    result: null as unknown,
    resultDigest: "",
    artifact,
    artifactDigest: hash(artifact),
    checkpoint: {
      stoppedConfirmed: true,
      reason: "OPERATOR_PAUSED",
      snapshotId: manifest.snapshotId,
      patchHash: manifest.manifestHash,
      baseRevision: manifest.baseRevision,
      codeRevision: manifest.headRevision,
    },
  };
  attempt.result = executionResultReportSchema.parse({
    schemaVersion: 1,
    workflowId: attempt.id,
    status: "PAUSED",
    reason: "OPERATOR_PAUSED",
    developerExecutions: 1,
    reviewerExecutions: 0,
    corrections: 0,
    checks: [],
    snapshots: [{ ...manifest, untrackedFiles: 0 }],
    review: null,
    diagnostic: "Operator paused",
    runtimeObservations: [],
  });
  attempt.resultDigest = hash(attempt.result);
  const job = orchestrationJobSchema.strict().parse({
    schemaVersion: 1,
    eventId: run.dispatchEventId,
    ticketId: ticket.id,
    projectId: ticket.projectId,
    ticketVersion: 2,
    baseRevision: core.baseRevision,
    projectDefinitionVersion: 1,
    executionSpecification: {
      schemaVersion: 1,
      project: {
        id: ticket.projectId,
        name: "Configured project",
        repoUrl: "https://example.test/project.git",
        baseRevision: core.baseRevision,
        definitionVersion: 1,
        definition: {
          summary: "Configured project",
          externalStack: "Existing stack",
          instructions: "Preserve scope",
          allowedPaths: ["src"],
          forbiddenPaths: [],
          checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"] }],
        },
      },
      ticket: {
        id: ticket.id,
        version: 2,
        title: ticket.title,
        objective: "Original objective",
        acceptanceCriteria: ["Checks pass"],
      },
    },
  });
  let event = { id: run.dispatchEventId, eventType: "ticket.ready.v1", payload: { ...job } };
  const tx = {
    run: {
      findUnique: vi.fn(async () => run),
      update: vi.fn(async ({ data }) => {
        Object.assign(run, { ...data, version: run.version + 1 });
        return run;
      }),
    },
    ticket: {
      findUnique: vi.fn(async () => ticket),
      update: vi.fn(async ({ data }) => {
        ticket.status = data.status;
        ticket.version++;
        return ticket;
      }),
    },
    attempt: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => attempt),
      findUnique: vi.fn(async () => attempt),
      create: vi.fn(async ({ data }) => ({ ...data, id: crypto.randomUUID() })),
    },
    outboxEvent: {
      findUnique: vi.fn(async () => event),
      create: vi.fn(async ({ data }) => {
        event = data;
        return event;
      }),
    },
    workerIdentity: { findUnique: vi.fn(async () => ({ status: "ONLINE" })) },
  };
  const prisma = { $transaction: vi.fn((fn) => fn(tx)) };
  // Persisted READY payload omits eventId: dispatcher supplies the row identity.
  const { eventId: _eventId, ...payload } = job;
  event.payload = payload as typeof event.payload;
  return {
    run,
    ticket,
    attempt,
    job,
    tx,
    prisma,
    service: new RunResumeService(prisma as never),
    input: {
      expectedVersion: run.version,
      attemptId: attempt.id,
      artifactDigest: attempt.artifactDigest,
    },
  };
}
describe("explicit stopped snapshot resume", () => {
  it("resumes waiting-provider evidence only through the same stopped snapshot gate", async () => {
    const f = fixture();
    f.run.status = "WAITING_PROVIDER";
    f.ticket.status = "WAITING_PROVIDER";
    f.attempt.checkpoint.reason = "WAITING_PROVIDER";
    f.attempt.result = executionResultReportSchema.parse({
      ...(f.attempt.result as object),
      status: "WAITING_PROVIDER",
      reason: "PROVIDER_UNAVAILABLE",
    });
    f.attempt.resultDigest = hash(f.attempt.result);
    await expect(f.service.request(f.run.id, f.input)).resolves.toMatchObject({
      status: "WAITING_WORKER",
    });
    expect(f.tx.attempt.create).not.toHaveBeenCalled();
  });
  it("freezes the original objective and origin in atomic outbox before a new claim", async () => {
    const f = fixture();
    await expect(f.service.request(f.run.id, f.input)).resolves.toMatchObject({
      status: "WAITING_WORKER",
    });
    expect(f.tx.attempt.create).not.toHaveBeenCalled();
    expect(f.run.nextFencingToken).toBe(1);
    expect(f.tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "run.resume.v1",
          payload: expect.objectContaining({
            executionSpecification: f.job.executionSpecification,
            resumeFrom: expect.objectContaining({ attemptId: f.attempt.id }),
          }),
        }),
      }),
    );
    await f.service.request(f.run.id, f.input);
    expect(f.tx.outboxEvent.create).toHaveBeenCalledOnce();
    const data = f.tx.outboxEvent.create.mock.calls[0]?.[0].data;
    const claimJob = orchestrationJobSchema.strict().parse({ ...data.payload, eventId: data.id });
    const orchestration = new OrchestrationService(f.prisma as never);
    await expect(
      orchestration.claim({ ...claimJob, workerId: f.attempt.workerId, leaseDurationMs: 30_000 }),
    ).resolves.toMatchObject({ fencingToken: 2, replayed: false });
    expect(f.tx.attempt.create).toHaveBeenCalledOnce();
    const fresh = f.tx.attempt.create.mock.results[0];
    f.tx.attempt.findFirst.mockResolvedValue(await fresh?.value);
    await expect(
      orchestration.claim({ ...claimJob, workerId: f.attempt.workerId, leaseDurationMs: 30_000 }),
    ).resolves.toMatchObject({ fencingToken: 2, replayed: true });
    expect(f.tx.attempt.create).toHaveBeenCalledOnce();
  });
  it.each(["version", "state", "unknown", "checkpoint", "digest", "bundle", "attempt", "fence"])(
    "rejects %s without mutation",
    async (mode) => {
      const f = fixture();
      if (mode === "version") f.run.version++;
      if (mode === "state") f.run.status = "VALIDATING";
      if (mode === "unknown") f.attempt.stoppedConfirmed = false;
      if (mode === "checkpoint") f.attempt.checkpoint.patchHash = "f".repeat(64);
      if (mode === "digest") f.attempt.resultDigest = "f".repeat(64);
      if (mode === "bundle") f.attempt.artifactDigest = "f".repeat(64);
      if (mode === "attempt") f.input.attemptId = crypto.randomUUID();
      if (mode === "fence") f.run.nextFencingToken++;
      await expect(f.service.request(f.run.id, f.input)).rejects.toThrow();
      expect(f.tx.outboxEvent.create).not.toHaveBeenCalled();
      expect(f.tx.run.update).not.toHaveBeenCalled();
    },
  );
  it("refuses tampered resume job and changed stopped evidence at claim", async () => {
    const f = fixture();
    await f.service.request(f.run.id, f.input);
    const data = f.tx.outboxEvent.create.mock.calls[0]?.[0].data;
    const job = orchestrationJobSchema.strict().parse({ ...data.payload, eventId: data.id });
    const orchestration = new OrchestrationService(f.prisma as never);
    await expect(
      orchestration.claim({
        ...job,
        ticketVersion: 99,
        workerId: f.attempt.workerId,
        leaseDurationMs: 30_000,
      }),
    ).rejects.toThrow();
    f.attempt.resultDigest = "f".repeat(64);
    await expect(
      orchestration.claim({ ...job, workerId: f.attempt.workerId, leaseDurationMs: 30_000 }),
    ).rejects.toThrow();
    expect(f.tx.attempt.create).not.toHaveBeenCalled();
  });
});
