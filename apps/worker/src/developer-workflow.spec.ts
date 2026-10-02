import type {
  DeveloperWorkflowRequest,
  RuntimeExecutionResult,
  SandboxCommandResult,
  WorkspaceSnapshot,
} from "@le-fabrique/contracts";
import { RuntimeGuard } from "@le-fabrique/runtime";
import { describe, expect, it, vi } from "vitest";
import { DeveloperWorkflow } from "./developer-workflow";

const workflowId = "00000000-0000-4000-8000-000000000010";
const baseRevision = "a".repeat(40);
const workspacePath = "/tmp/fac-009-workspace";
const timestamp = "2026-10-01T12:00:00.000Z";

function request(maxCorrectionRounds = 2, maxAttempts = 6): DeveloperWorkflowRequest {
  return {
    schemaVersion: 1,
    workflowId,
    repositoryPath: "/tmp/fac-009-repository",
    baseRevision,
    objective: "Implementar incremento sintetico",
    acceptanceCriteria: ["Checks sem regressao", "Reviewer aprova"],
    contextSources: [{ path: "README.md", role: "INSTRUCTION" }],
    contextLimits: { maxFiles: 10, maxFileBytes: 10_000, maxTotalBytes: 20_000 },
    checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"], environment: {} }],
    writablePaths: ["src"],
    guardPolicy: {
      schemaVersion: 1,
      maxAttempts,
      maxElapsedMs: 30 * 60 * 1000,
      maxProviderSwitches: 0,
      repeatedFailureLimit: 2,
      subscriptionOnly: true,
      monthlyApiBudget: 0,
      apiFallbackEnabled: false,
      paidExtrasAllowed: false,
    },
    runtimeLimits: { timeoutMs: 60_000, maxLogBytes: 100_000 },
    sandboxLimits: {
      timeoutMs: 60_000,
      maxLogBytes: 100_000,
      memoryBytes: 256 * 1024 * 1024,
      cpuQuotaPercent: 100,
      maxProcesses: 64,
      maxOpenFiles: 256,
      maxFileBytes: 10 * 1024 * 1024,
    },
    snapshotLimits: { maxUntrackedFiles: 100, maxArtifactBytes: 10 * 1024 * 1024 },
    maxCorrectionRounds,
    modelRequested: null,
  };
}

function runtimeResult(
  executionId: string,
  finalMessage: string | null,
  status: RuntimeExecutionResult["status"] = "COMPLETED",
): RuntimeExecutionResult {
  return {
    schemaVersion: 1,
    executionId,
    provider: "codex",
    status,
    exitCode: status === "COMPLETED" ? 0 : 1,
    providerSessionId: null,
    modelRequested: null,
    modelEffective: null,
    finalMessage,
    usage: null,
    error:
      status === "COMPLETED"
        ? null
        : { code: "TRANSIENT", message: "synthetic failure", retryable: true },
    startedAt: timestamp,
    finishedAt: timestamp,
  };
}

function checkResult(
  status: SandboxCommandResult["status"],
  stoppedConfirmed = true,
): SandboxCommandResult {
  return {
    schemaVersion: 1,
    executionId: crypto.randomUUID(),
    unitName: "le-fabrique-test.service",
    status,
    exitCode: status === "COMPLETED" ? 0 : 1,
    stdout: "",
    stderr: "",
    startedAt: timestamp,
    finishedAt: timestamp,
    stoppedConfirmed,
  };
}

function snapshot(sequence: number): WorkspaceSnapshot {
  return {
    artifactPath: `/tmp/fac-009-snapshots/${sequence}`,
    manifest: {
      schemaVersion: 1,
      snapshotId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      baseRevision,
      headRevision: baseRevision,
      patchBytes: sequence,
      patchSha256: String(sequence).padStart(64, "0"),
      untracked: [],
      totalArtifactBytes: sequence,
      createdAt: timestamp,
      manifestHash: String(sequence + 10).padStart(64, "0"),
    },
  };
}

function dependencies(
  adapterResults: RuntimeExecutionResult[],
  checkResults: SandboxCommandResult[],
  maxAttempts = 6,
) {
  let snapshotSequence = 0;
  return {
    workspaceManager: {
      create: vi.fn().mockResolvedValue({
        executionId: workflowId,
        workspacePath,
        revision: baseRevision,
        detached: true,
      }),
    },
    contextBuilder: {
      build: vi.fn().mockResolvedValue({
        manifest: {
          schemaVersion: 1,
          baseRevision,
          sources: [],
          omissions: [],
          totalBytes: 0,
          truncated: false,
          manifestHash: "b".repeat(64),
        },
        content: "synthetic context",
      }),
    },
    guard: new RuntimeGuard(request(2, maxAttempts).guardPolicy),
    adapter: { execute: vi.fn().mockImplementation(async () => adapterResults.shift()) },
    sandbox: { execute: vi.fn().mockImplementation(async () => checkResults.shift()) },
    snapshots: {
      capture: vi.fn().mockImplementation(async () => {
        snapshotSequence += 1;
        return snapshot(snapshotSequence);
      }),
    },
    createId: () => crypto.randomUUID(),
  };
}

const approved = JSON.stringify({
  schemaVersion: 1,
  verdict: "APPROVE",
  summary: "Criterios comprovados",
  findings: [],
});
const rejected = JSON.stringify({
  schemaVersion: 1,
  verdict: "REQUEST_CHANGES",
  summary: "Mesmo problema",
  findings: ["Corrigir validacao"],
});

describe("DeveloperWorkflow", () => {
  it("separates a pre-existing baseline failure and awaits human after independent review", async () => {
    const deps = dependencies(
      [
        runtimeResult(crypto.randomUUID(), "implemented"),
        runtimeResult(crypto.randomUUID(), approved),
      ],
      [checkResult("FAILED"), checkResult("FAILED")],
    );
    const result = await new DeveloperWorkflow(deps).execute(request());

    expect(result).toMatchObject({
      status: "AWAITING_HUMAN",
      reason: "APPROVED",
      developerExecutions: 1,
      reviewerExecutions: 1,
      corrections: 0,
    });
    expect(result.checks).toEqual([
      expect.objectContaining({ phase: "BASELINE", preExisting: false, status: "FAILED" }),
      expect.objectContaining({ phase: "POST_CHANGE", preExisting: true, status: "FAILED" }),
    ]);
    expect(deps.adapter.execute.mock.calls[0]?.[0]).toMatchObject({
      permissionMode: "WORKSPACE_WRITE",
      writablePaths: ["src"],
    });
    expect(deps.adapter.execute.mock.calls[1]?.[0]).toMatchObject({
      permissionMode: "READ_ONLY",
      writablePaths: [],
    });
  });

  it("runs one bounded correction after a new regression", async () => {
    const deps = dependencies(
      [
        runtimeResult(crypto.randomUUID(), "first change"),
        runtimeResult(crypto.randomUUID(), "corrected change"),
        runtimeResult(crypto.randomUUID(), approved),
      ],
      [checkResult("COMPLETED"), checkResult("FAILED"), checkResult("COMPLETED")],
    );
    const result = await new DeveloperWorkflow(deps).execute(request());

    expect(result).toMatchObject({
      status: "AWAITING_HUMAN",
      developerExecutions: 2,
      reviewerExecutions: 1,
      corrections: 1,
    });
    expect(result.snapshots).toHaveLength(2);
  });

  it("fails closed when reviewer output is not the required JSON verdict", async () => {
    const deps = dependencies(
      [
        runtimeResult(crypto.randomUUID(), "implemented"),
        runtimeResult(crypto.randomUUID(), "looks good"),
      ],
      [checkResult("COMPLETED"), checkResult("COMPLETED")],
    );
    await expect(new DeveloperWorkflow(deps).execute(request())).resolves.toMatchObject({
      status: "FAILED",
      reason: "REVIEW_INVALID",
      reviewerExecutions: 1,
    });
  });

  it("pauses before reviewer when the runtime guard attempt budget is exhausted", async () => {
    const deps = dependencies(
      [runtimeResult(crypto.randomUUID(), "implemented")],
      [checkResult("COMPLETED"), checkResult("COMPLETED")],
      1,
    );
    await expect(new DeveloperWorkflow(deps).execute(request(2, 1))).resolves.toMatchObject({
      status: "PAUSED_LIMIT",
      reason: "RUNTIME_GUARD",
      developerExecutions: 1,
      reviewerExecutions: 0,
    });
  });

  it("pauses after the same reviewer failure repeats twice", async () => {
    const deps = dependencies(
      [
        runtimeResult(crypto.randomUUID(), "first change"),
        runtimeResult(crypto.randomUUID(), rejected),
        runtimeResult(crypto.randomUUID(), "second change"),
        runtimeResult(crypto.randomUUID(), rejected),
      ],
      [checkResult("COMPLETED"), checkResult("COMPLETED"), checkResult("COMPLETED")],
    );
    await expect(new DeveloperWorkflow(deps).execute(request())).resolves.toMatchObject({
      status: "PAUSED_LIMIT",
      reason: "REVIEW_REJECTED",
      developerExecutions: 2,
      reviewerExecutions: 2,
      corrections: 1,
    });
  });

  it("fails before developer when baseline process termination is not confirmed", async () => {
    const deps = dependencies([], [checkResult("TIMED_OUT", false)]);
    await expect(new DeveloperWorkflow(deps).execute(request())).resolves.toMatchObject({
      status: "FAILED",
      reason: "CHECK_UNQUIESCED",
      developerExecutions: 0,
      reviewerExecutions: 0,
      snapshots: [],
    });
    expect(deps.adapter.execute).not.toHaveBeenCalled();
    expect(deps.snapshots.capture).not.toHaveBeenCalled();
  });
});
