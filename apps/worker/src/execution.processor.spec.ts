import type { DeveloperWorkflowResult, OrchestrationJob } from "@le-fabrique/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { processOrchestrationExecution, WriterQuiescenceError } from "./execution.processor";
import { createTrustedWorkflowProfile } from "./execution-profile";
import type { PreparedRepositoryCheckout } from "./repository-checkout";

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
        input: { outcome: "VALIDATING" | "CANCELLED" | "FAILED" | "PAUSED_LIMIT" },
      ) => ({ runId, attemptId, status: input.outcome, stoppedConfirmed: true }),
    ),
  };
  const workflow = {
    execute: vi.fn().mockResolvedValue(approvedWorkflow(attemptId)),
    cancelActive: vi.fn().mockResolvedValue(true),
  };
  return {
    input: {
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
      signal.throwIfAborted();
      return approvedWorkflow(deps.attemptId);
    });
    const pending = processOrchestrationExecution(job(), deps.input, stop.signal);
    await vi.waitFor(() => expect(deps.workflow.execute).toHaveBeenCalledOnce());
    stop.abort();
    await expect(pending).resolves.toMatchObject({ status: "CANCELLED", reason: "WORKER_STOPPED" });
    expect(deps.workflow.cancelActive).toHaveBeenCalledBefore(deps.control.checkpoint);
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
});
