import type {
  FactoryConfiguration,
  ProviderHandoffRequest,
  RuntimeExecutionResult,
} from "@le-fabrique/contracts";
import { RuntimeGuard } from "@le-fabrique/runtime";
import { describe, expect, it, vi } from "vitest";
import { resolveAgentRoute } from "./agent-route";
import { ProviderHandoff } from "./provider-handoff";

const baseRevision = "a".repeat(40);
const hash = "b".repeat(64);

function configuration(state: "AVAILABLE" | "AUTH_REQUIRED" = "AVAILABLE"): FactoryConfiguration {
  const roles = ["PLANNER", "DEVELOPER", "REVIEWER", "QA", "DOCUMENTATION", "SECURITY"] as const;
  return {
    installations: [
      {
        id: "claude-review",
        provider: "CLAUDE",
        label: "Claude review",
        executable: "claude",
        enabled: true,
        state,
        authMode: "SUBSCRIPTION_CLI",
        models: ["claude-synthetic"],
        defaultModel: "claude-synthetic",
      },
    ],
    assignments: roles.map((role) => ({
      role,
      enabled: role === "REVIEWER",
      installationId: role === "REVIEWER" ? "claude-review" : null,
      model: role === "REVIEWER" ? "claude-synthetic" : null,
      permissionMode: "READ_ONLY",
      timeoutMinutes: 30,
      maxAttempts: 2,
    })),
    github: {
      authMode: "GH_CLI",
      state: "DISCONNECTED",
      host: "github.com",
      owner: null,
      repository: null,
      baseBranch: "main",
      pullRequestCreationEnabled: false,
      mergeEnabled: false,
    },
    financialSafety: {
      apiEnabled: false,
      extraUsageEnabled: false,
      paidCreditsEnabled: false,
      autoRechargeEnabled: false,
      paidFallbackEnabled: false,
    },
  };
}

function sourceEvidence(): ProviderHandoffRequest["source"] {
  return {
    executionId: "11111111-1111-4111-8111-111111111111",
    provider: "codex",
    status: "FAILED",
    errorCode: "RATE_LIMITED",
    finishedAt: "2026-10-01T12:01:00.000Z",
  };
}

function request(config = configuration()): ProviderHandoffRequest {
  return {
    schemaVersion: 1,
    handoffId: "22222222-2222-4222-8222-222222222222",
    source: sourceEvidence(),
    sourceStoppedConfirmed: true,
    targetRole: "REVIEWER",
    repositoryPath: "/srv/repos/project",
    baseRevision,
    snapshot: {
      artifactPath: "/srv/snapshots/snapshot-1",
      manifest: {
        schemaVersion: 1,
        snapshotId: "33333333-3333-4333-8333-333333333333",
        baseRevision,
        headRevision: baseRevision,
        patchBytes: 10,
        patchSha256: hash,
        untracked: [],
        totalArtifactBytes: 10,
        createdAt: "2026-10-01T12:01:00.000Z",
        manifestHash: hash,
      },
    },
    objective: "Review the restored change",
    acceptanceCriteria: ["No regression"],
    configuration: config,
    guardState: {
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      attempts: 1,
      providerSwitches: 0,
      lastProvider: "codex",
      lastFailure: null,
    },
    runtimeLimits: { timeoutMs: 30_000, maxLogBytes: 16_384 },
  };
}

function completedExecution(input: { prompt: string }): RuntimeExecutionResult {
  return {
    schemaVersion: 1,
    executionId: "44444444-4444-4444-8444-444444444444",
    provider: "claude",
    status: "COMPLETED",
    exitCode: 0,
    providerSessionId: "target-session",
    modelRequested: "claude-synthetic",
    modelEffective: "claude-synthetic",
    finalMessage: `reviewed:${input.prompt.length}`,
    usage: null,
    error: null,
    startedAt: "2026-10-01T12:02:00.000Z",
    finishedAt: "2026-10-01T12:03:00.000Z",
  };
}

function guard(maxProviderSwitches = 2) {
  return new RuntimeGuard({
    schemaVersion: 1,
    maxAttempts: 3,
    maxElapsedMs: 30 * 60 * 1_000,
    maxProviderSwitches,
    repeatedFailureLimit: 2,
    subscriptionOnly: true,
    monthlyApiBudget: 0,
    apiFallbackEnabled: false,
    paidExtrasAllowed: false,
  });
}

describe("provider handoff", () => {
  it("resolves the configured employee provider and model", () => {
    expect(resolveAgentRoute(configuration(), "REVIEWER")).toEqual({
      role: "REVIEWER",
      installationId: "claude-review",
      provider: "claude",
      model: "claude-synthetic",
      permissionMode: "READ_ONLY",
    });
    expect(() => resolveAgentRoute(configuration("AUTH_REQUIRED"), "REVIEWER")).toThrow(
      "not available",
    );
  });

  it("restores a verified snapshot in a new workspace without transferring source session data", async () => {
    const workspaceManager = {
      create: vi.fn().mockResolvedValue({
        executionId: "22222222-2222-4222-8222-222222222222",
        workspacePath: "/srv/workspaces/handoff",
        revision: baseRevision,
        detached: true,
      }),
    };
    const snapshots = {
      restore: vi.fn().mockResolvedValue({
        snapshotId: "33333333-3333-4333-8333-333333333333",
        workspacePath: "/srv/workspaces/handoff",
        baseRevision,
        patchApplied: true,
        untrackedFilesRestored: 0,
      }),
    };
    const execute = vi.fn(async (input) => completedExecution(input));
    const handoff = new ProviderHandoff({
      workspaceManager: workspaceManager as never,
      snapshots: snapshots as never,
      guard: guard(),
      adapters: { claude: { execute } },
      createId: () => "44444444-4444-4444-8444-444444444444",
    });

    const result = await handoff.execute(request());

    expect(result).toMatchObject({
      status: "COMPLETED",
      route: { provider: "claude", model: "claude-synthetic" },
      guardState: { providerSwitches: 1, lastProvider: "claude" },
    });
    expect(workspaceManager.create).toHaveBeenCalledWith({
      executionId: "22222222-2222-4222-8222-222222222222",
      repositoryPath: "/srv/repos/project",
      revision: baseRevision,
    });
    expect(snapshots.restore).toHaveBeenCalledWith(request().snapshot, "/srv/workspaces/handoff");
    const targetRequest = execute.mock.calls[0]?.[0];
    expect(targetRequest.modelRequested).toBe("claude-synthetic");
    expect(JSON.stringify(request())).not.toContain("providerSessionId");
    expect(JSON.stringify(request())).not.toContain("finalMessage");
  });

  it("waits without creating a workspace when the configured provider is not eligible", async () => {
    const workspaceManager = { create: vi.fn() };
    const handoff = new ProviderHandoff({
      workspaceManager: workspaceManager as never,
      snapshots: { restore: vi.fn() } as never,
      guard: guard(),
      adapters: {},
    });

    await expect(handoff.execute(request(configuration("AUTH_REQUIRED")))).resolves.toMatchObject({
      status: "WAITING_PROVIDER",
      route: null,
    });
    expect(workspaceManager.create).not.toHaveBeenCalled();
  });

  it("pauses before workspace creation when the provider switch limit is exhausted", async () => {
    const workspaceManager = { create: vi.fn() };
    const handoff = new ProviderHandoff({
      workspaceManager: workspaceManager as never,
      snapshots: { restore: vi.fn() } as never,
      guard: guard(0),
      adapters: { claude: { execute: vi.fn() } },
    });

    await expect(handoff.execute(request())).resolves.toMatchObject({
      status: "PAUSED_LIMIT",
      diagnostic: "Handoff blocked by PROVIDER_SWITCH_LIMIT",
    });
    expect(workspaceManager.create).not.toHaveBeenCalled();
  });

  it("rejects an unconfirmed stop or snapshot from another base", async () => {
    const handoff = new ProviderHandoff({
      workspaceManager: { create: vi.fn() } as never,
      snapshots: { restore: vi.fn() } as never,
      guard: guard(),
      adapters: {},
    });
    await expect(
      handoff.execute({ ...request(), sourceStoppedConfirmed: false } as never),
    ).rejects.toThrow();
    await expect(
      handoff.execute({
        ...request(),
        snapshot: {
          ...request().snapshot,
          manifest: { ...request().snapshot.manifest, baseRevision: "c".repeat(40) },
        },
      }),
    ).rejects.toThrow("Snapshot must belong");
    await expect(
      handoff.execute({
        ...request(),
        snapshot: {
          ...request().snapshot,
          manifest: {
            ...request().snapshot.manifest,
            createdAt: "2026-10-01T11:59:00.000Z",
          },
        },
      }),
    ).rejects.toThrow("Snapshot must be captured after");
  });
});
