import { describe, expect, it } from "vitest";
import {
  contextBuildRequestSchema,
  createProjectSchema,
  createTicketSchema,
  developerWorkflowRequestSchema,
  factoryConfigurationSchema,
  healthResponseSchema,
  orchestrationCheckpointRequestSchema,
  orchestrationJobSchema,
  readyTicketSchema,
  runtimeEventSchema,
  runtimeExecutionRequestSchema,
  runtimeExecutionResultSchema,
  runtimeGuardPolicySchema,
  sandboxCommandRequestSchema,
  workerProbeJobSchema,
  workerRegistrationSchema,
} from "./index.js";

const validConfiguration = {
  installations: [
    {
      id: "codex-main",
      provider: "CODEX" as const,
      label: "Codex principal",
      executable: "/usr/bin/codex",
      enabled: true,
      state: "AUTH_REQUIRED" as const,
      authMode: "SUBSCRIPTION_CLI" as const,
      models: ["gpt-test"],
      defaultModel: "gpt-test",
    },
  ],
  assignments: ["PLANNER", "DEVELOPER", "REVIEWER", "QA", "DOCUMENTATION", "SECURITY"].map(
    (role) => ({
      role,
      enabled: role === "DEVELOPER",
      installationId: role === "DEVELOPER" ? "codex-main" : null,
      model: role === "DEVELOPER" ? "gpt-test" : null,
      permissionMode: role === "DEVELOPER" ? "WORKSPACE_WRITE" : "READ_ONLY",
      timeoutMinutes: 30,
      maxAttempts: 2,
    }),
  ),
  github: {
    authMode: "GH_CLI" as const,
    state: "DISCONNECTED" as const,
    host: "github.com",
    owner: null,
    repository: null,
    baseBranch: "main",
    pullRequestCreationEnabled: false,
    mergeEnabled: false as const,
  },
  financialSafety: {
    apiEnabled: false as const,
    extraUsageEnabled: false as const,
    paidCreditsEnabled: false as const,
    autoRechargeEnabled: false as const,
    paidFallbackEnabled: false as const,
  },
};

describe("shared contracts", () => {
  it("accepts a valid health response", () => {
    expect(
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        timestamp: "2026-09-30T00:00:00.000Z",
      }),
    ).toBeDefined();
  });

  it("rejects a queue payload without a valid correlation id", () => {
    expect(() =>
      workerProbeJobSchema.parse({ requestedAt: "2026-09-30T00:00:00.000Z", correlationId: "x" }),
    ).toThrow();
  });

  it("validates control-plane commands at runtime", () => {
    expect(
      createProjectSchema.parse({
        name: "Projeto sintético",
        repoUrl: "https://example.test/repository.git",
        baseRef: "main",
      }),
    ).toBeDefined();
    expect(() =>
      createTicketSchema.parse({ title: "Ticket", objective: "Objetivo", acceptanceCriteria: [] }),
    ).toThrow();
    expect(() => readyTicketSchema.parse({ expectedVersion: 0 })).toThrow();
  });

  it("rejects an incomplete worker identity", () => {
    expect(() =>
      workerRegistrationSchema.parse({ id: crypto.randomUUID(), name: "worker" }),
    ).toThrow();
  });

  it("validates runtime requests, events and nullable observations", () => {
    const executionId = crypto.randomUUID();
    expect(
      runtimeExecutionRequestSchema.parse({
        schemaVersion: 1,
        executionId,
        workspacePath: "/tmp/fixture",
        prompt: "inspect fixture",
        permissionMode: "READ_ONLY",
        limits: { timeoutMs: 1_000, maxLogBytes: 4_096 },
      }),
    ).toMatchObject({ modelRequested: null });
    expect(() =>
      runtimeEventSchema.parse({
        type: "progress",
        executionId,
        timestamp: "2026-09-30T00:00:00.000Z",
        category: "reasoning",
      }),
    ).toThrow();
    expect(
      runtimeExecutionResultSchema.parse({
        schemaVersion: 1,
        executionId,
        provider: "codex",
        status: "COMPLETED",
        exitCode: 0,
        providerSessionId: "session",
        modelRequested: null,
        modelEffective: null,
        finalMessage: "done",
        usage: null,
        error: null,
        startedAt: "2026-09-30T00:00:00.000Z",
        finishedAt: "2026-09-30T00:00:01.000Z",
      }),
    ).toBeDefined();
  });

  it("validates context and subscription-only guard contracts", () => {
    expect(
      contextBuildRequestSchema.parse({
        schemaVersion: 1,
        workspacePath: "/tmp/fixture",
        baseRevision: "7044a0a",
        sources: [{ path: "README.md", role: "INSTRUCTION" }],
        limits: { maxFiles: 10, maxFileBytes: 4_096, maxTotalBytes: 16_384 },
      }),
    ).toBeDefined();
    expect(() =>
      contextBuildRequestSchema.parse({
        schemaVersion: 1,
        workspacePath: "/tmp/fixture",
        baseRevision: "7044a0a",
        sources: [
          { path: "README.md", role: "INSTRUCTION" },
          { path: "README.md", role: "SOURCE" },
        ],
        limits: { maxFiles: 10, maxFileBytes: 4_096, maxTotalBytes: 16_384 },
      }),
    ).toThrow();
    expect(() =>
      runtimeGuardPolicySchema.parse({
        schemaVersion: 1,
        maxAttempts: 2,
        maxElapsedMs: 1_000,
        maxProviderSwitches: 1,
        repeatedFailureLimit: 2,
        subscriptionOnly: true,
        monthlyApiBudget: 1,
        apiFallbackEnabled: true,
        paidExtrasAllowed: true,
      }),
    ).toThrow();
  });

  it("validates sandbox resource bounds", () => {
    expect(
      sandboxCommandRequestSchema.parse({
        schemaVersion: 1,
        executionId: crypto.randomUUID(),
        workspacePath: "/tmp/workspace",
        command: "/usr/bin/node",
        args: [],
        limits: {
          timeoutMs: 1_000,
          maxLogBytes: 4_096,
          memoryBytes: 256 * 1024 * 1024,
          cpuQuotaPercent: 100,
          maxProcesses: 64,
          maxOpenFiles: 256,
          maxFileBytes: 16 * 1024 * 1024,
        },
      }),
    ).toMatchObject({ environment: {} });
    expect(() =>
      sandboxCommandRequestSchema.parse({
        schemaVersion: 1,
        executionId: crypto.randomUUID(),
        workspacePath: "/tmp/workspace",
        command: "/usr/bin/node",
        args: [],
        limits: {
          timeoutMs: 10,
          maxLogBytes: 1,
          memoryBytes: 1,
          cpuQuotaPercent: 1,
          maxProcesses: 1,
          maxOpenFiles: 1,
          maxFileBytes: 1,
        },
      }),
    ).toThrow();
  });

  it("validates orchestration jobs and complete checkpoint identity", () => {
    expect(
      orchestrationJobSchema.parse({
        schemaVersion: 1,
        eventId: crypto.randomUUID(),
        projectId: crypto.randomUUID(),
        ticketId: crypto.randomUUID(),
        ticketVersion: 2,
        baseRevision: "a".repeat(40),
      }),
    ).toBeDefined();
    expect(() =>
      orchestrationCheckpointRequestSchema.parse({
        workerId: crypto.randomUUID(),
        fencingToken: 1,
        baseRevision: "a".repeat(40),
        codeRevision: null,
        snapshotId: null,
        patchHash: "short",
        reason: "COMPLETED",
        stoppedConfirmed: true,
      }),
    ).toThrow();
  });

  it("bounds developer workflow corrections and trusted checks", () => {
    const base = {
      schemaVersion: 1 as const,
      workflowId: crypto.randomUUID(),
      repositoryPath: "/tmp/repository",
      baseRevision: "a".repeat(40),
      objective: "Implementar fixture",
      acceptanceCriteria: ["Passa"],
      contextSources: [{ path: "README.md", role: "INSTRUCTION" as const }],
      contextLimits: { maxFiles: 10, maxFileBytes: 10_000, maxTotalBytes: 20_000 },
      checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"], environment: {} }],
      guardPolicy: {
        schemaVersion: 1 as const,
        maxAttempts: 4,
        maxElapsedMs: 60_000,
        maxProviderSwitches: 0,
        repeatedFailureLimit: 2,
        subscriptionOnly: true as const,
        monthlyApiBudget: 0 as const,
        apiFallbackEnabled: false as const,
        paidExtrasAllowed: false as const,
      },
      runtimeLimits: { timeoutMs: 60_000, maxLogBytes: 10_000 },
      sandboxLimits: {
        timeoutMs: 60_000,
        maxLogBytes: 10_000,
        memoryBytes: 256 * 1024 * 1024,
        cpuQuotaPercent: 100,
        maxProcesses: 64,
        maxOpenFiles: 256,
        maxFileBytes: 10 * 1024 * 1024,
      },
      snapshotLimits: { maxUntrackedFiles: 100, maxArtifactBytes: 10 * 1024 * 1024 },
      modelRequested: null,
    };
    expect(developerWorkflowRequestSchema.parse({ ...base, maxCorrectionRounds: 2 })).toBeDefined();
    expect(() =>
      developerWorkflowRequestSchema.parse({ ...base, maxCorrectionRounds: 3 }),
    ).toThrow();
  });

  it("validates settings relationships and rejects credential fields", () => {
    expect(factoryConfigurationSchema.parse(validConfiguration)).toBeDefined();
    expect(() =>
      factoryConfigurationSchema.parse({
        ...validConfiguration,
        installations: [{ ...validConfiguration.installations[0], token: "must-not-enter-dto" }],
      }),
    ).toThrow();
    expect(() =>
      factoryConfigurationSchema.parse({
        ...validConfiguration,
        assignments: validConfiguration.assignments.map((assignment) =>
          assignment.role === "DEVELOPER" ? { ...assignment, model: "not-allowed" } : assignment,
        ),
      }),
    ).toThrow();
  });
});
