import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DeveloperWorkflowResult, OrchestrationJob } from "@le-fabrique/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InterruptionEvidenceError,
  processFinalizationRecovery,
  processOrchestrationExecution,
  WriterQuiescenceError,
} from "./execution.processor";
import { createTrustedWorkflowProfile } from "./execution-profile";
import type { PreparedRepositoryCheckout } from "./repository-checkout";
import { ResultJournal } from "./result-journal";

const projectId = crypto.randomUUID();
const ticketId = crypto.randomUUID();
const baseRevision = "a".repeat(40);

function job(): OrchestrationJob {
  return {
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    ticketId,
    projectId,
    ticketVersion: 1,
    baseRevision,
    projectDefinitionVersion: 1,
    executionSpecification: {
      schemaVersion: 1,
      project: {
        id: projectId,
        name: "Synthetic project",
        repoUrl: "https://example.test/project.git",
        baseRevision,
        definitionVersion: 1,
        definition: {
          summary: "synthetic",
          externalStack: "configured externally",
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
        version: 1,
        title: "Synthetic ticket",
        objective: "Implement a synthetic change",
        acceptanceCriteria: ["Check passes"],
      },
    },
  };
}

function approvedWorkflow(workflowId = crypto.randomUUID()): DeveloperWorkflowResult {
  return {
    schemaVersion: 1,
    workflowId,
    status: "AWAITING_HUMAN",
    reason: "APPROVED",
    workspace: {
      executionId: crypto.randomUUID(),
      workspacePath: "/tmp/work",
      revision: baseRevision,
      detached: true,
    },
    contextManifest: {
      schemaVersion: 1,
      baseRevision,
      sources: [],
      omissions: [],
      totalBytes: 0,
      truncated: false,
      manifestHash: "e".repeat(64),
    },
    guardState: {
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      attempts: 2,
      providerSwitches: 0,
      lastProvider: "codex",
      lastFailure: null,
    },
    checks: [
      {
        phase: "POST_CHANGE",
        round: 0,
        name: "test",
        status: "COMPLETED",
        exitCode: 0,
        preExisting: false,
        stoppedConfirmed: true,
      },
    ],
    snapshots: [
      {
        schemaVersion: 1,
        snapshotId: crypto.randomUUID(),
        baseRevision,
        headRevision: "b".repeat(40),
        patchBytes: 10,
        patchSha256: "c".repeat(64),
        untracked: [],
        totalArtifactBytes: 10,
        createdAt: new Date().toISOString(),
        manifestHash: "d".repeat(64),
      },
    ],
    developerExecutions: 1,
    reviewerExecutions: 1,
    corrections: 0,
    review: { schemaVersion: 1, verdict: "APPROVE", summary: "Synthetic review", findings: [] },
    diagnostic: "Synthetic workflow completed",
    runtimeObservations: [],
  };
}

function dependencies() {
  const attemptId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const control = {
    reportArtifact: vi.fn().mockResolvedValue({ attemptId, digest: "f".repeat(64) }),
    reconcile: vi.fn().mockResolvedValue({ state: null }),
    reportResult: vi.fn().mockResolvedValue({ attemptId, digest: "f".repeat(64) }),
    claim: vi.fn().mockResolvedValue({
      runId,
      attemptId,
      workerId: crypto.randomUUID(),
      fencingToken: 4,
      leaseExpiresAt: new Date(Date.now() + 90_000).toISOString(),
      replayed: false,
    }),
    renew: vi
      .fn()
      .mockResolvedValue({ leaseExpiresAt: new Date(Date.now() + 90_000).toISOString() }),
    checkpoint: vi
      .fn()
      .mockResolvedValue({ runId, attemptId, status: "RUNNING", stoppedConfirmed: true }),
    complete: vi.fn(
      async (
        _id: string,
        input: { outcome: "VALIDATING" | "CANCELLED" | "FAILED" | "PAUSED" | "PAUSED_LIMIT" },
      ) => ({ runId, attemptId, status: input.outcome, stoppedConfirmed: true }),
    ),
  };
  const workflow = {
    execute: vi.fn().mockResolvedValue(approvedWorkflow(attemptId)),
    cancelActive: vi.fn().mockResolvedValue(true),
  };
  return {
    input: {
      readArtifact: vi.fn().mockResolvedValue({}),
      journal: {
        load: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
      },
      control,
      leaseDurationMs: 90_000,
      prepareCheckout: vi.fn().mockResolvedValue({
        path: "/srv/checkouts/attempt",
        projectId,
        workflowId: attemptId,
        repositoryUrl: "https://example.test/project.git",
        baseRevision,
      }),
      createProfile: vi.fn((payload: OrchestrationJob, checkout: PreparedRepositoryCheckout) => {
        if (!payload.executionSpecification) throw new Error("Missing specification");
        return createTrustedWorkflowProfile(payload.executionSpecification, checkout);
      }),
      createWorkflow: vi.fn().mockReturnValue(workflow),
    },
    attemptId,
    control,
    workflow,
  };
}

describe("processOrchestrationExecution", () => {
  afterEach(() => vi.useRealTimers());

  it("recovers only preserved finalization after failed upload, with no second execution", async () => {
    const deps = dependencies();
    const originalJob = job();
    deps.control.reportResult.mockRejectedValueOnce(new Error("upload failed"));
    await expect(processOrchestrationExecution(originalJob, deps.input)).rejects.toThrow(
      "upload failed",
    );
    const intent = deps.input.journal.save.mock.calls[0]?.[1];
    if (!intent) throw new Error("Missing preserved intent");
    deps.input.journal.load.mockResolvedValue(intent);
    const workerId = crypto.randomUUID();
    deps.control.reconcile.mockResolvedValue({
      state: {
        runId: intent.runId,
        attemptId: intent.attemptId,
        status: "VALIDATING",
        stoppedConfirmed: true,
      },
    });
    const recovered = await processFinalizationRecovery(
      {
        schemaVersion: 1,
        mode: "FINALIZATION_ONLY",
        eventId: crypto.randomUUID(),
        runId: intent.runId,
        attemptId: intent.attemptId,
        workerId,
        fencingToken: intent.fencingToken,
        originalJob,
      },
      workerId,
      deps.input,
    );
    expect(recovered).toMatchObject({ recovered: true, status: "VALIDATING" });
    expect(deps.control.claim).toHaveBeenCalledOnce();
    expect(deps.input.prepareCheckout).toHaveBeenCalledOnce();
    expect(deps.workflow.execute).toHaveBeenCalledOnce();
    expect(deps.control.complete).not.toHaveBeenCalled();
    expect(deps.control.reportArtifact).toHaveBeenCalledBefore(deps.control.checkpoint);
  });

  it("leaves missing evidence unresolved without claim, checkout, AI or stop assertion", async () => {
    const deps = dependencies();
    const workerId = crypto.randomUUID();
    const result = await processFinalizationRecovery(
      {
        schemaVersion: 1,
        mode: "FINALIZATION_ONLY",
        eventId: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        attemptId: deps.attemptId,
        workerId,
        fencingToken: 1,
        originalJob: job(),
      },
      workerId,
      deps.input,
    );
    expect(result).toMatchObject({ recovered: false, status: "EVIDENCE_REQUIRED" });
    expect(deps.control.claim).not.toHaveBeenCalled();
    expect(deps.input.prepareCheckout).not.toHaveBeenCalled();
    expect(deps.workflow.execute).not.toHaveBeenCalled();
    expect(deps.control.checkpoint).not.toHaveBeenCalled();
  });

  it("refuses another worker and a mismatched journal before reporting", async () => {
    const deps = dependencies();
    const workerId = crypto.randomUUID();
    const recovery = {
      schemaVersion: 1 as const,
      mode: "FINALIZATION_ONLY" as const,
      eventId: crypto.randomUUID(),
      runId: crypto.randomUUID(),
      attemptId: deps.attemptId,
      workerId,
      fencingToken: 1,
      originalJob: job(),
    };
    await expect(
      processFinalizationRecovery(recovery, crypto.randomUUID(), deps.input),
    ).rejects.toThrow("original worker");
    expect(deps.input.journal.load).not.toHaveBeenCalled();
    deps.input.journal.load.mockResolvedValue({
      runId: crypto.randomUUID(),
      attemptId: recovery.attemptId,
      fencingToken: 1,
    });
    await expect(processFinalizationRecovery(recovery, workerId, deps.input)).rejects.toThrow(
      "Journal does not match",
    );
    expect(deps.control.reportResult).not.toHaveBeenCalled();
  });

  it("runs the immutable job and checkpoints before completing as VALIDATING", async () => {
    const deps = dependencies();
    const payload = job();
    await expect(processOrchestrationExecution(payload, deps.input)).resolves.toMatchObject({
      status: "VALIDATING",
      workflowStatus: "AWAITING_HUMAN",
      reason: "APPROVED",
    });
    expect(deps.control.checkpoint).toHaveBeenCalledBefore(deps.control.complete);
    expect(deps.control.reportResult).toHaveBeenCalledBefore(deps.control.checkpoint);
    expect(deps.control.reportResult).toHaveBeenCalledBefore(deps.control.reportArtifact);
    expect(deps.control.reportArtifact).toHaveBeenCalledBefore(deps.control.checkpoint);
    expect(deps.control.checkpoint).toHaveBeenCalledWith(
      deps.attemptId,
      expect.objectContaining({
        fencingToken: 4,
        baseRevision,
        codeRevision: "b".repeat(40),
        stoppedConfirmed: true,
      }),
    );
    expect(deps.input.prepareCheckout).toHaveBeenCalledWith(
      payload,
      expect.anything(),
      expect.anything(),
    );
  });

  it("does not create a second writer for an idempotent replay", async () => {
    const deps = dependencies();
    deps.control.claim.mockResolvedValueOnce({
      runId: crypto.randomUUID(),
      attemptId: deps.attemptId,
      workerId: crypto.randomUUID(),
      fencingToken: 4,
      leaseExpiresAt: new Date(Date.now() + 90_000).toISOString(),
      replayed: true,
    });
    await expect(processOrchestrationExecution(job(), deps.input)).resolves.toMatchObject({
      status: "REPLAY_SKIPPED",
      replayed: true,
    });
    expect(deps.input.prepareCheckout).not.toHaveBeenCalled();
    expect(deps.control.checkpoint).not.toHaveBeenCalled();
  });

  it("fails closed if writer quiescence cannot be confirmed after lease loss", async () => {
    vi.useFakeTimers();
    const deps = dependencies();
    deps.input.leaseDurationMs = 15_000;
    deps.control.renew.mockRejectedValue(new Error("control unavailable"));
    deps.workflow.execute.mockImplementation(async (signal: AbortSignal) => {
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      return approvedWorkflow(deps.attemptId);
    });
    deps.workflow.cancelActive.mockResolvedValue(false);
    const pending = processOrchestrationExecution(job(), deps.input);
    const rejected = expect(pending).rejects.toBeInstanceOf(WriterQuiescenceError);
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    expect(deps.control.complete).not.toHaveBeenCalled();
  });

  it.each(["FAILED", "PAUSED_LIMIT"] as const)("maps %s without false approval", async (status) => {
    const deps = dependencies();
    deps.workflow.execute.mockResolvedValue({
      ...approvedWorkflow(deps.attemptId),
      status,
      reason: "RUNTIME_ROUTE_UNAVAILABLE",
    });
    await expect(processOrchestrationExecution(job(), deps.input)).resolves.toMatchObject({
      status,
    });
    expect(deps.control.complete).toHaveBeenCalledWith(deps.attemptId, {
      fencingToken: 4,
      outcome: status,
    });
  });

  it("rejects a mismatched checkout before creating a workflow", async () => {
    const deps = dependencies();
    deps.input.prepareCheckout.mockResolvedValue({
      path: "/srv/checkouts/wrong",
      projectId,
      workflowId: deps.attemptId,
      repositoryUrl: "https://example.test/other.git",
      baseRevision,
    });
    await expect(processOrchestrationExecution(job(), deps.input)).resolves.toMatchObject({
      status: "FAILED",
      reason: "EXECUTION_SETUP_FAILED",
    });
    expect(deps.input.createWorkflow).not.toHaveBeenCalled();
  });

  it("does not release an attempt when a completed check lacks stop evidence", async () => {
    const deps = dependencies();
    const result = approvedWorkflow(deps.attemptId);
    result.checks = result.checks.map((check) => ({ ...check, stoppedConfirmed: false }));
    deps.workflow.execute.mockResolvedValue(result);
    await expect(processOrchestrationExecution(job(), deps.input)).rejects.toBeInstanceOf(
      WriterQuiescenceError,
    );
    expect(deps.control.checkpoint).not.toHaveBeenCalled();
    expect(deps.control.complete).not.toHaveBeenCalled();
  });

  it("propagates claim conflicts without starting checkout", async () => {
    const deps = dependencies();
    deps.control.claim.mockRejectedValue(new Error("fencing conflict"));
    await expect(processOrchestrationExecution(job(), deps.input)).rejects.toThrow(
      "fencing conflict",
    );
    expect(deps.input.prepareCheckout).not.toHaveBeenCalled();
  });

  it("rejects provider overrides in the job envelope before claiming", async () => {
    const deps = dependencies();
    await expect(
      processOrchestrationExecution({ ...job(), modelRequested: "injected" }, deps.input),
    ).rejects.toThrow();
    expect(deps.control.claim).not.toHaveBeenCalled();
  });

  it("cancels an active workflow on worker shutdown and waits for stop evidence", async () => {
    const deps = dependencies();
    const stop = new AbortController();
    deps.workflow.execute.mockImplementation(async (signal: AbortSignal) => {
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      return { ...approvedWorkflow(deps.attemptId), status: "CANCELLED", reason: "INTERRUPTED" };
    });
    const pending = processOrchestrationExecution(job(), deps.input, stop.signal);
    await vi.waitFor(() => expect(deps.workflow.execute).toHaveBeenCalledOnce());
    stop.abort();
    await expect(pending).resolves.toMatchObject({ status: "CANCELLED", reason: "INTERRUPTED" });
    expect(deps.input.journal.save).toHaveBeenCalledBefore(deps.control.checkpoint);
  });

  it("does not complete when result persistence fails", async () => {
    const deps = dependencies();
    deps.control.reportResult.mockRejectedValue(new Error("result unavailable"));
    await expect(processOrchestrationExecution(job(), deps.input)).rejects.toThrow(
      "result unavailable",
    );
    expect(deps.control.checkpoint).not.toHaveBeenCalled();
    expect(deps.control.complete).not.toHaveBeenCalled();
  });

  it("reconciles a stopped replay without starting checkout or AI", async () => {
    const deps = dependencies();
    const claim = await deps.control.claim();
    deps.control.claim.mockResolvedValue({ ...claim, replayed: true });
    deps.control.reconcile.mockResolvedValue({
      state: {
        runId: claim.runId,
        attemptId: claim.attemptId,
        status: "VALIDATING",
        stoppedConfirmed: true,
      },
    } as never);
    await expect(processOrchestrationExecution(job(), deps.input)).resolves.toMatchObject({
      status: "VALIDATING",
      replayed: true,
    });
    expect(deps.control.reconcile).toHaveBeenCalledWith(claim.attemptId, 4);
    expect(deps.input.prepareCheckout).not.toHaveBeenCalled();
    expect(deps.workflow.execute).not.toHaveBeenCalled();
    expect(deps.control.complete).not.toHaveBeenCalled();
  });

  it("propagates replay reconciliation failures without new work", async () => {
    const deps = dependencies();
    const claim = await deps.control.claim();
    deps.control.claim.mockResolvedValue({ ...claim, replayed: true });
    deps.control.reconcile.mockRejectedValue(new Error("control unavailable"));
    await expect(processOrchestrationExecution(job(), deps.input)).rejects.toThrow(
      "control unavailable",
    );
    expect(deps.input.prepareCheckout).not.toHaveBeenCalled();
  });

  it("recovers a failed result upload after restart without claim, checkout or AI", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fac-012o-restart-"));
    try {
      const deps = dependencies();
      const payload = job();
      const journal = new ResultJournal(root);
      deps.control.reportResult.mockRejectedValueOnce(new Error("network unavailable"));
      await expect(
        processOrchestrationExecution(payload, { ...deps.input, journal }),
      ).rejects.toThrow("network unavailable");
      expect(deps.control.complete).not.toHaveBeenCalled();
      const preserved = await journal.load(payload);
      expect(preserved?.attemptId).toBe(deps.attemptId);
      const restarted = dependencies();
      await expect(
        processOrchestrationExecution(payload, {
          ...restarted.input,
          journal: new ResultJournal(root),
        }),
      ).resolves.toMatchObject({ attemptId: deps.attemptId, status: "VALIDATING", replayed: true });
      expect(restarted.control.claim).not.toHaveBeenCalled();
      expect(restarted.input.prepareCheckout).not.toHaveBeenCalled();
      expect(restarted.workflow.execute).not.toHaveBeenCalled();
      expect(restarted.control.reportResult).toHaveBeenCalledWith(
        deps.attemptId,
        expect.objectContaining({ fencingToken: 4 }),
      );
      expect(await journal.load(payload)).toEqual(preserved);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not upload or complete if local journal cannot preserve the result", async () => {
    const deps = dependencies();
    deps.input.journal.save.mockRejectedValue(new Error("disk full"));
    await expect(processOrchestrationExecution(job(), deps.input)).rejects.toThrow("disk full");
    expect(deps.control.reportResult).not.toHaveBeenCalled();
    expect(deps.control.checkpoint).not.toHaveBeenCalled();
    expect(deps.control.complete).not.toHaveBeenCalled();
  });

  it("never journals unknown writer termination", async () => {
    const deps = dependencies();
    const result = approvedWorkflow(deps.attemptId);
    result.checks[0].stoppedConfirmed = false;
    deps.workflow.execute.mockResolvedValue(result);
    await expect(processOrchestrationExecution(job(), deps.input)).rejects.toBeInstanceOf(
      WriterQuiescenceError,
    );
    expect(deps.input.journal.save).not.toHaveBeenCalled();
  });

  it.each(["read", "upload"])(
    "preserves journal without completing when artifact %s fails",
    async (mode) => {
      const deps = dependencies();
      if (mode === "read") deps.input.readArtifact.mockRejectedValue(new Error("artifact blocked"));
      else deps.control.reportArtifact.mockRejectedValue(new Error("artifact unavailable"));
      await expect(processOrchestrationExecution(job(), deps.input)).rejects.toThrow("artifact");
      expect(deps.input.journal.save).toHaveBeenCalledOnce();
      expect(deps.control.checkpoint).not.toHaveBeenCalled();
      expect(deps.control.complete).not.toHaveBeenCalled();
    },
  );

  it("does not release stopped work if workflow cannot return preservation evidence", async () => {
    const deps = dependencies();
    deps.workflow.execute.mockRejectedValue(new Error("snapshot failed"));
    await expect(processOrchestrationExecution(job(), deps.input)).rejects.toBeInstanceOf(
      InterruptionEvidenceError,
    );
    expect(deps.control.checkpoint).not.toHaveBeenCalled();
    expect(deps.control.complete).not.toHaveBeenCalled();
  });

  it.each(["PAUSE", "CANCEL"] as const)(
    "preserves operator %s before acknowledging completion",
    async (action) => {
      vi.useFakeTimers();
      const deps = dependencies();
      deps.input.leaseDurationMs = 15_000;
      deps.control.renew.mockResolvedValue({
        leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
        controlAction: action,
      });
      deps.workflow.execute.mockImplementation(async (signal: AbortSignal) => {
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true }),
        );
        return {
          ...approvedWorkflow(deps.attemptId),
          status: action === "PAUSE" ? "PAUSED" : "CANCELLED",
          reason: action === "PAUSE" ? "OPERATOR_PAUSED" : "OPERATOR_CANCELLED",
        };
      });
      const pending = processOrchestrationExecution(job(), deps.input);
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(pending).resolves.toMatchObject({
        status: action === "PAUSE" ? "PAUSED" : "CANCELLED",
      });
      expect(deps.input.journal.save).toHaveBeenCalledBefore(deps.control.reportResult);
      expect(deps.control.reportArtifact).toHaveBeenCalledBefore(deps.control.checkpoint);
    },
  );

  it("journals cancelled partial work after proven lease loss", async () => {
    vi.useFakeTimers();
    const deps = dependencies();
    deps.input.leaseDurationMs = 15_000;
    deps.control.renew.mockRejectedValue(new Error("lease lost"));
    deps.workflow.execute.mockImplementation(async (signal: AbortSignal) => {
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      return { ...approvedWorkflow(deps.attemptId), status: "CANCELLED", reason: "INTERRUPTED" };
    });
    const pending = processOrchestrationExecution(job(), deps.input);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toMatchObject({ status: "CANCELLED", reason: "LEASE_LOST" });
    expect(deps.input.journal.save).toHaveBeenCalledBefore(deps.control.reportResult);
    expect(deps.control.reportArtifact).toHaveBeenCalledBefore(deps.control.checkpoint);
  });

  it("keeps operator stop fenced when writer termination is unknown", async () => {
    vi.useFakeTimers();
    const deps = dependencies();
    deps.input.leaseDurationMs = 15_000;
    deps.control.renew.mockResolvedValue({
      leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
      controlAction: "PAUSE",
    });
    deps.workflow.cancelActive.mockResolvedValue(false);
    deps.workflow.execute.mockImplementation(async (signal: AbortSignal) => {
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      return { ...approvedWorkflow(deps.attemptId), status: "PAUSED", reason: "OPERATOR_PAUSED" };
    });
    const pending = processOrchestrationExecution(job(), deps.input);
    const rejected = expect(pending).rejects.toBeInstanceOf(WriterQuiescenceError);
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    expect(deps.input.journal.save).not.toHaveBeenCalled();
    expect(deps.control.complete).not.toHaveBeenCalled();
  });
});
