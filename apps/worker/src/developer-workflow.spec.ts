import type {
  DeveloperWorkflowRequest,
  RuntimeExecutionResult,
  SandboxCommandResult,
  WorkspaceSnapshot,
} from "@le-fabrique/contracts";
import { RuntimeGuard } from "@le-fabrique/runtime";
import { describe, expect, it, vi } from "vitest";
import { ProviderUnavailableError } from "./agent-route";
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
      maxProviderSwitches: 8,
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
  const execute = vi.fn().mockImplementation(async (input: { modelRequested: string | null }) => {
    const result = adapterResults.shift();
    if (!result) throw new Error("No synthetic runtime result available");
    return {
      ...result,
      provider: input.modelRequested?.startsWith("claude-") ? "claude" : "codex",
      modelRequested: input.modelRequested,
    };
  });
  const codex = {
    name: "codex",
    execute,
    cancel: vi.fn(async (executionId: string) => ({ executionId, status: "NOT_FOUND" as const })),
  };
  const claude = {
    name: "claude",
    execute,
    cancel: vi.fn(async (executionId: string) => ({ executionId, status: "NOT_FOUND" as const })),
  };
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
    execute,
    agentRouter: {
      resolve: vi.fn().mockImplementation(async (role: "DEVELOPER" | "REVIEWER") => ({
        route:
          role === "DEVELOPER"
            ? {
                role,
                installationId: "developer-installation",
                provider: "codex",
                model: "codex-model-selected-in-ui",
                permissionMode: "WORKSPACE_WRITE",
              }
            : {
                role,
                installationId: "reviewer-installation",
                provider: "claude",
                model: "claude-model-selected-in-ui",
                permissionMode: "READ_ONLY",
              },
        adapter: role === "DEVELOPER" ? codex : claude,
        timeoutMs: 60_000,
        maxAttempts: 2,
        configurationVersion: 1,
        configurationObservedAt: timestamp,
      })),
    },
    codex,
    claude,
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
  it("does not reset the total call budget when handing off to another account", async () => {
    const failed = runtimeResult(crypto.randomUUID(), null, "FAILED");
    failed.error = { code: "PROVIDER_BUSY", message: "busy", retryable: true };
    const deps = dependencies([failed], [checkResult("COMPLETED")], 1);
    const original = deps.agentRouter.resolve.getMockImplementation();
    deps.agentRouter.resolve.mockImplementation(async (role, excluded: string[] = []) => {
      const runtime = await original?.(role);
      if (!runtime) throw new Error("Missing fixture route");
      if (excluded.length) runtime.route.installationId = "approved-alternative";
      return runtime;
    });
    deps.workspaceManager.create
      .mockResolvedValueOnce({
        executionId: workflowId,
        workspacePath,
        revision: baseRevision,
        detached: true,
      })
      .mockResolvedValue({
        executionId: crypto.randomUUID(),
        workspacePath: `${workspacePath}-handoff`,
        revision: baseRevision,
        detached: true,
      });
    const restore = vi.fn(async () => ({
      snapshotId: snapshot(1).manifest.snapshotId,
      workspacePath: `${workspacePath}-handoff`,
      baseRevision,
      patchApplied: true,
      untrackedFilesRestored: 0,
    }));
    const result = await new DeveloperWorkflow({
      ...deps,
      snapshots: { ...deps.snapshots, restore },
    }).execute(request(2, 1));
    expect(result.status).toBe("PAUSED_LIMIT");
    expect(result.handoffs).toHaveLength(1);
    expect(deps.execute).toHaveBeenCalledOnce();
    expect(result.snapshots).toHaveLength(1);
  });
  it.each(["DEVELOPER", "REVIEWER"] as const)(
    "restores stopped %s work in another worktree before the explicitly configured alternative",
    async (role) => {
      const failed = runtimeResult(crypto.randomUUID(), null, "FAILED");
      failed.error = { code: "RATE_LIMITED", message: "quota reached", retryable: true };
      const deps = dependencies(
        role === "DEVELOPER"
          ? [
              failed,
              runtimeResult(crypto.randomUUID(), "done"),
              runtimeResult(crypto.randomUUID(), approved),
            ]
          : [
              runtimeResult(crypto.randomUUID(), "done"),
              failed,
              runtimeResult(crypto.randomUUID(), approved),
            ],
        [checkResult("COMPLETED"), checkResult("COMPLETED")],
      );
      const original = deps.agentRouter.resolve.getMockImplementation();
      deps.agentRouter.resolve.mockImplementation(
        async (requestedRole, excluded: string[] = []) => {
          const runtime = await original?.(requestedRole);
          if (!runtime) throw new Error("Missing fixture route");
          if (excluded.includes(runtime.route.installationId))
            runtime.route.installationId = `${requestedRole.toLowerCase()}-approved-alternative`;
          return runtime;
        },
      );
      deps.workspaceManager.create
        .mockResolvedValueOnce({
          executionId: workflowId,
          workspacePath,
          revision: baseRevision,
          detached: true,
        })
        .mockResolvedValue({
          executionId: crypto.randomUUID(),
          workspacePath: `${workspacePath}-handoff`,
          revision: baseRevision,
          detached: true,
        });
      const restore = vi.fn(async () => ({
        snapshotId: snapshot(1).manifest.snapshotId,
        workspacePath: `${workspacePath}-handoff`,
        baseRevision,
        patchApplied: true,
        untrackedFilesRestored: 0,
      }));
      const result = await new DeveloperWorkflow({
        ...deps,
        snapshots: { ...deps.snapshots, restore },
      }).execute(request());
      expect(result.status).toBe("AWAITING_HUMAN");
      expect(result.corrections).toBe(0);
      expect(result.developerExecutions).toBe(role === "DEVELOPER" ? 2 : 1);
      expect(result.reviewerExecutions).toBe(role === "REVIEWER" ? 2 : 1);
      expect(result.handoffs).toEqual([
        expect.objectContaining({
          role,
          sourceExecutionId: failed.executionId,
          reason: "RATE_LIMITED",
          toInstallationId: `${role.toLowerCase()}-approved-alternative`,
        }),
      ]);
      expect(deps.workspaceManager.create).toHaveBeenCalledTimes(2);
      expect(deps.contextBuilder.build).toHaveBeenCalledTimes(2);
      expect(deps.sandbox.execute).toHaveBeenCalledTimes(2);
      expect(restore).toHaveBeenCalledOnce();
      const fallbackCall = role === "DEVELOPER" ? 1 : 2;
      expect(restore.mock.invocationCallOrder[0]).toBeLessThan(
        deps.execute.mock.invocationCallOrder[fallbackCall] ?? 0,
      );
      expect(result.runtimeObservations[fallbackCall]?.installationId).toBe(
        `${role.toLowerCase()}-approved-alternative`,
      );
    },
  );
  it("preserves source evidence and starts no alternative after restoration failure", async () => {
    const failed = runtimeResult(crypto.randomUUID(), null, "FAILED");
    failed.error = { code: "AUTH_REQUIRED", message: "expired", retryable: false };
    const deps = dependencies([failed], [checkResult("COMPLETED")]);
    const original = deps.agentRouter.resolve.getMockImplementation();
    deps.agentRouter.resolve.mockImplementation(async (role, excluded: string[] = []) => {
      const runtime = await original?.(role);
      if (!runtime) throw new Error("Missing fixture route");
      if (excluded.length) runtime.route.installationId = "approved-alternative";
      return runtime;
    });
    deps.workspaceManager.create
      .mockResolvedValueOnce({
        executionId: workflowId,
        workspacePath,
        revision: baseRevision,
        detached: true,
      })
      .mockResolvedValue({
        executionId: crypto.randomUUID(),
        workspacePath: `${workspacePath}-handoff`,
        revision: baseRevision,
        detached: true,
      });
    const restore = vi.fn().mockRejectedValue(new Error("integrity failure"));
    const result = await new DeveloperWorkflow({
      ...deps,
      snapshots: { ...deps.snapshots, restore },
    }).execute(request());
    expect(result.status).toBe("FAILED");
    expect(result.snapshots).toHaveLength(1);
    expect(result.handoffs).toEqual([]);
    expect(deps.execute).toHaveBeenCalledOnce();
  });
  it.each(["AUTH_REQUIRED", "RATE_LIMITED", "PROVIDER_BUSY"] as const)(
    "preserves stopped Developer work and waits on %s without correction loops",
    async (code) => {
      const failed = runtimeResult(crypto.randomUUID(), null, "FAILED");
      failed.error = { code, message: "synthetic provider unavailable", retryable: true };
      const deps = dependencies([failed], [checkResult("COMPLETED")]);
      const result = await new DeveloperWorkflow(deps).execute(request());
      expect(result).toMatchObject({
        status: "WAITING_PROVIDER",
        reason: "PROVIDER_UNAVAILABLE",
        developerExecutions: 1,
        reviewerExecutions: 0,
        corrections: 0,
      });
      expect(result.runtimeObservations[0]?.errorCode).toBe(code);
      expect(result.snapshots).toHaveLength(1);
      expect(deps.execute).toHaveBeenCalledOnce();
      expect(deps.execute).toHaveBeenCalledBefore(deps.snapshots.capture);
    },
  );
  it.each(["AUTH_REQUIRED", "RATE_LIMITED", "PROVIDER_BUSY"] as const)(
    "preserves work and waits on Reviewer %s instead of invalid verdict",
    async (code) => {
      const failed = runtimeResult(crypto.randomUUID(), null, "FAILED");
      failed.error = { code, message: "synthetic provider unavailable", retryable: true };
      const deps = dependencies(
        [runtimeResult(crypto.randomUUID(), "implemented"), failed],
        [checkResult("COMPLETED"), checkResult("COMPLETED")],
      );
      const result = await new DeveloperWorkflow(deps).execute(request());
      expect(result).toMatchObject({
        status: "WAITING_PROVIDER",
        developerExecutions: 1,
        reviewerExecutions: 1,
        corrections: 0,
        review: null,
      });
      expect(result.snapshots).toHaveLength(2);
      expect(deps.execute).toHaveBeenCalledTimes(2);
    },
  );
  it("waits before a call only for typed provider unavailability, preserving clean snapshot", async () => {
    const deps = dependencies([], [checkResult("COMPLETED")]);
    deps.agentRouter.resolve.mockRejectedValue(new ProviderUnavailableError());
    const result = await new DeveloperWorkflow(deps).execute(request());
    expect(result.status).toBe("WAITING_PROVIDER");
    expect(result.snapshots).toHaveLength(1);
    expect(deps.execute).not.toHaveBeenCalled();
  });
  it("never fabricates waiting when a runtime process rejects with unknown stop", async () => {
    const deps = dependencies([], [checkResult("COMPLETED")]);
    deps.execute.mockRejectedValue(new Error("AUTH_REQUIRED but termination unknown"));
    await expect(new DeveloperWorkflow(deps).execute(request())).rejects.toThrow(
      "termination unknown",
    );
    expect(deps.snapshots.capture).not.toHaveBeenCalled();
  });
  it("preserves partial writes from a failed Developer before returning a retryable pause", async () => {
    const deps = dependencies(
      [runtimeResult(crypto.randomUUID(), null, "FAILED")],
      [checkResult("COMPLETED")],
    );
    const result = await new DeveloperWorkflow(deps).execute(request(0));
    expect(result).toMatchObject({ status: "PAUSED_LIMIT", reason: "DEVELOPER_FAILED" });
    expect(result.snapshots).toHaveLength(1);
    expect(deps.execute).toHaveBeenCalledBefore(deps.snapshots.capture);
  });
  it("measures clean baseline before restore, rebuilds context and continues preserved work", async () => {
    const deps = dependencies(
      [
        runtimeResult(crypto.randomUUID(), "preserved work completed"),
        runtimeResult(crypto.randomUUID(), approved),
      ],
      [checkResult("COMPLETED"), checkResult("COMPLETED")],
    );
    const restore = vi.fn(async () => ({
      snapshotId: snapshot(1).manifest.snapshotId,
      workspacePath,
      baseRevision,
      patchApplied: true,
      untrackedFilesRestored: 0,
    }));
    const result = await new DeveloperWorkflow({
      ...deps,
      snapshots: { ...deps.snapshots, restore },
    }).execute(request(), undefined, snapshot(1));
    expect(result.status).toBe("AWAITING_HUMAN");
    expect(deps.sandbox.execute).toHaveBeenCalledBefore(restore);
    expect(restore).toHaveBeenCalledBefore(deps.execute);
    expect(deps.contextBuilder.build).toHaveBeenCalledTimes(2);
    expect(deps.contextBuilder.build.mock.invocationCallOrder[1]).toBeGreaterThan(
      restore.mock.invocationCallOrder[0] ?? 0,
    );
    expect(deps.execute.mock.calls[0]?.[0].prompt).toContain("Do not reapply its patch");
  });
  it("never reclassifies preserved regression as a preexisting baseline failure", async () => {
    const deps = dependencies(
      [runtimeResult(crypto.randomUUID(), "still failing")],
      [checkResult("COMPLETED"), checkResult("FAILED")],
    );
    const restore = vi.fn(async () => ({
      snapshotId: snapshot(1).manifest.snapshotId,
      workspacePath,
      baseRevision,
      patchApplied: true,
      untrackedFilesRestored: 0,
    }));
    const result = await new DeveloperWorkflow({
      ...deps,
      snapshots: { ...deps.snapshots, restore },
    }).execute(request(0), undefined, snapshot(1));
    expect(result.reason).toBe("CHECK_REGRESSION");
    expect(result.checks.at(-1)?.preExisting).toBe(false);
    expect(result.reviewerExecutions).toBe(0);
  });
  it("starts no agent after restore failure or mismatched base", async () => {
    const deps = dependencies([], [checkResult("COMPLETED")]);
    const restore = vi.fn().mockRejectedValue(new Error("restore integrity failure"));
    const workflow = new DeveloperWorkflow({ ...deps, snapshots: { ...deps.snapshots, restore } });
    await expect(workflow.execute(request(), undefined, snapshot(1))).rejects.toThrow(
      "restore integrity",
    );
    expect(deps.execute).not.toHaveBeenCalled();
    const wrong = snapshot(1);
    wrong.manifest.baseRevision = "f".repeat(40);
    await expect(workflow.execute(request(), undefined, wrong)).rejects.toThrow("same-base");
  });
  it("cancels a live runtime and confirms quiescence before preserving interruption", async () => {
    const deps = dependencies(
      [runtimeResult(crypto.randomUUID(), "unused")],
      [checkResult("COMPLETED")],
    );
    let resolveExecution: ((result: RuntimeExecutionResult) => void) | undefined;
    deps.execute.mockImplementationOnce(
      () => new Promise<RuntimeExecutionResult>((resolve) => (resolveExecution = resolve)),
    );
    deps.codex.cancel.mockImplementation(async (executionId) => {
      resolveExecution?.(runtimeResult(executionId, null, "CANCELLED"));
      return { executionId, status: "CANCELLED" as const };
    });
    const workflow = new DeveloperWorkflow(deps);
    const controller = new AbortController();
    const execution = workflow.execute(request(), controller.signal);
    await vi.waitFor(() => expect(deps.execute).toHaveBeenCalledOnce());

    controller.abort();
    await expect(execution).resolves.toMatchObject({ status: "CANCELLED", reason: "INTERRUPTED" });
    await expect(workflow.cancelActive()).resolves.toBe(true);
    expect(deps.codex.cancel).toHaveBeenCalledOnce();
  });

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
    expect(result.runtimeObservations).toEqual([
      expect.objectContaining({
        role: "DEVELOPER",
        installationId: "developer-installation",
        modelRequested: "codex-model-selected-in-ui",
        modelEffective: null,
        usage: null,
      }),
      expect.objectContaining({
        role: "REVIEWER",
        installationId: "reviewer-installation",
        modelRequested: "claude-model-selected-in-ui",
        modelEffective: null,
        usage: null,
      }),
    ]);
    expect(result.checks).toEqual([
      expect.objectContaining({ phase: "BASELINE", preExisting: false, status: "FAILED" }),
      expect.objectContaining({ phase: "POST_CHANGE", preExisting: true, status: "FAILED" }),
    ]);
    expect(deps.agentRouter.resolve.mock.calls.map(([role]) => role)).toEqual([
      "DEVELOPER",
      "REVIEWER",
    ]);
    expect(deps.execute.mock.calls[0]?.[0]).toMatchObject({
      permissionMode: "WORKSPACE_WRITE",
      writablePaths: ["src"],
    });
    expect(deps.execute.mock.calls[0]?.[0]).toMatchObject({
      modelRequested: "codex-model-selected-in-ui",
    });
    expect(deps.execute.mock.calls[1]?.[0]).toMatchObject({
      permissionMode: "READ_ONLY",
      writablePaths: [],
      modelRequested: "claude-model-selected-in-ui",
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
    expect(deps.agentRouter.resolve.mock.calls.map(([role]) => role)).toEqual([
      "DEVELOPER",
      "DEVELOPER",
      "REVIEWER",
    ]);
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
    expect(deps.execute).not.toHaveBeenCalled();
    expect(deps.snapshots.capture).not.toHaveBeenCalled();
  });

  it("fails closed before adapter execution when a configured route cannot be resolved", async () => {
    const deps = dependencies([], [checkResult("COMPLETED")]);
    deps.agentRouter.resolve = vi.fn().mockRejectedValue(new Error("No enabled route configured"));

    await expect(new DeveloperWorkflow(deps).execute(request())).resolves.toMatchObject({
      status: "FAILED",
      reason: "RUNTIME_ROUTE_UNAVAILABLE",
      diagnostic: "Configured Developer runtime route is unavailable",
      developerExecutions: 0,
      reviewerExecutions: 0,
    });
    expect(deps.execute).not.toHaveBeenCalled();
  });

  it("fails closed when a Reviewer route is not read-only", async () => {
    const deps = dependencies(
      [runtimeResult(crypto.randomUUID(), "implemented")],
      [checkResult("COMPLETED"), checkResult("COMPLETED")],
    );
    deps.agentRouter.resolve = vi
      .fn()
      .mockImplementation(async (role: "DEVELOPER" | "REVIEWER") => {
        if (role === "DEVELOPER") {
          return {
            route: {
              role,
              installationId: "developer-installation",
              provider: "codex",
              model: "codex-model-selected-in-ui",
              permissionMode: "WORKSPACE_WRITE",
            },
            adapter: { name: "codex", execute: deps.execute },
            configurationVersion: 1,
            configurationObservedAt: timestamp,
          };
        }
        return {
          route: {
            role,
            installationId: "reviewer-installation",
            provider: "claude",
            model: "claude-model-selected-in-ui",
            permissionMode: "WORKSPACE_WRITE",
          },
          adapter: { name: "claude", execute: deps.execute },
          configurationVersion: 1,
          configurationObservedAt: timestamp,
        };
      });

    await expect(new DeveloperWorkflow(deps).execute(request())).resolves.toMatchObject({
      status: "FAILED",
      reason: "RUNTIME_ROUTE_UNAVAILABLE",
      developerExecutions: 1,
      reviewerExecutions: 0,
    });
    expect(deps.execute).toHaveBeenCalledTimes(1);
  });

  it.each(["PAUSE", "CANCEL"] as const)("preserves %s as an operator request", async (action) => {
    const { ExecutionControlRequestedError } = await import("./lease-guard");
    const stop = new AbortController();
    const deps = dependencies([], []);
    deps.sandbox.execute.mockImplementation(async () => {
      stop.abort(new ExecutionControlRequestedError(action, false));
      return checkResult("TIMED_OUT", true);
    });
    const result = await new DeveloperWorkflow(deps).execute(request(), stop.signal);
    expect(result).toMatchObject({
      status: action === "PAUSE" ? "PAUSED" : "CANCELLED",
      reason: action === "PAUSE" ? "OPERATOR_PAUSED" : "OPERATOR_CANCELLED",
    });
    expect(result.snapshots).toHaveLength(1);
    expect(deps.execute).not.toHaveBeenCalled();
  });

  it("preserves aborted baseline and captures only after known termination", async () => {
    const stop = new AbortController();
    const deps = dependencies([], []);
    deps.sandbox.execute.mockImplementation(async () => {
      stop.abort();
      return checkResult("TIMED_OUT", true);
    });
    const result = await new DeveloperWorkflow(deps).execute(request(), stop.signal);
    expect(result).toMatchObject({
      status: "CANCELLED",
      reason: "INTERRUPTED",
      developerExecutions: 0,
      checks: [{ phase: "BASELINE", status: "TIMED_OUT", stoppedConfirmed: true }],
    });
    expect(result.snapshots).toHaveLength(1);
    expect(deps.execute).not.toHaveBeenCalled();
    expect(deps.sandbox.execute).toHaveBeenCalledBefore(deps.snapshots.capture);
  });

  it("keeps cancelled Developer observation and patch without starting Reviewer", async () => {
    const stop = new AbortController();
    const deps = dependencies([], [checkResult("COMPLETED")]);
    deps.execute.mockImplementation(async () => {
      stop.abort();
      return runtimeResult(crypto.randomUUID(), null, "CANCELLED");
    });
    const result = await new DeveloperWorkflow(deps).execute(request(), stop.signal);
    expect(result).toMatchObject({
      status: "CANCELLED",
      developerExecutions: 1,
      reviewerExecutions: 0,
      runtimeObservations: [{ role: "DEVELOPER", status: "CANCELLED" }],
    });
    expect(result.snapshots).toHaveLength(1);
    expect(deps.execute).toHaveBeenCalledTimes(1);
    expect(deps.execute).toHaveBeenCalledBefore(deps.snapshots.capture);
  });

  it("never forgets unknown sandbox termination when the callback is removed", async () => {
    const stop = new AbortController();
    const deps = dependencies([], []);
    deps.sandbox.execute.mockImplementation(async () => {
      stop.abort();
      return checkResult("TIMED_OUT", false);
    });
    const workflow = new DeveloperWorkflow(deps);
    await expect(workflow.execute(request(), stop.signal)).rejects.toThrow();
    expect(await workflow.cancelActive()).toBe(false);
    expect(deps.snapshots.capture).not.toHaveBeenCalled();
  });

  it("treats rejected client execution as unknown instead of empty-set quiescence", async () => {
    const deps = dependencies([], [checkResult("COMPLETED")]);
    deps.execute.mockRejectedValue(new Error("unknown process"));
    const workflow = new DeveloperWorkflow(deps);
    await expect(workflow.execute(request())).rejects.toThrow("unknown process");
    expect(await workflow.cancelActive()).toBe(false);
    expect(deps.snapshots.capture).not.toHaveBeenCalled();
  });

  it("propagates interruption snapshot failure instead of fabricating cancelled evidence", async () => {
    const stop = new AbortController();
    const deps = dependencies([], []);
    deps.sandbox.execute.mockImplementation(async () => {
      stop.abort();
      return checkResult("TIMED_OUT", true);
    });
    deps.snapshots.capture.mockRejectedValue(new Error("snapshot unavailable"));
    await expect(new DeveloperWorkflow(deps).execute(request(), stop.signal)).rejects.toThrow(
      "snapshot unavailable",
    );
  });
});
