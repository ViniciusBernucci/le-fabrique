import { describe, expect, it } from "vitest";
import {
  completeGithubOnboardingSchema,
  completeGithubPullRequestSchema,
  completeGithubRepositoryVerificationSchema,
  completeGithubVerificationSchema,
  contextBuildRequestSchema,
  createProjectSchema,
  createTicketSchema,
  developerWorkflowRequestSchema,
  factoryConfigurationSchema,
  gitCommitShaSchema,
  githubOnboardingChallengeSchema,
  githubOnboardingJobSchema,
  githubPullRequestJobSchema,
  githubRepositoryVerificationJobSchema,
  githubVerificationJobSchema,
  healthResponseSchema,
  orchestrationCheckpointRequestSchema,
  orchestrationJobSchema,
  projectDefinitionInputSchema,
  providerHandoffRequestSchema,
  providerOnboardingChallengeSchema,
  providerOnboardingJobSchema,
  readyTicketSchema,
  runtimeEventSchema,
  runtimeExecutionRequestSchema,
  runtimeExecutionResultSchema,
  runtimeGuardPolicySchema,
  sandboxCommandRequestSchema,
  updateProjectBaseRevisionSchema,
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
  it("validates a configurable project definition without shell commands", () => {
    const definition = {
      summary: "Aplicacao externa cadastrada pelo operador",
      externalStack: "Stack descoberta no repositorio externo",
      instructions: "Preservar as convencoes locais e nao executar deploy.",
      allowedPaths: ["src", "tests"],
      forbiddenPaths: ["secrets"],
      checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"] }],
    };
    expect(projectDefinitionInputSchema.parse(definition)).toEqual(definition);
    expect(() =>
      projectDefinitionInputSchema.parse({ ...definition, allowedPaths: ["../outside"] }),
    ).toThrow();
    expect(() =>
      projectDefinitionInputSchema.parse({
        ...definition,
        allowedPaths: ["src"],
        forbiddenPaths: ["src/generated"],
      }),
    ).toThrow();
  });

  it("requires an exact lowercase Git commit SHA for executable base revisions", () => {
    const revision = "a".repeat(40);
    expect(gitCommitShaSchema.parse(revision)).toBe(revision);
    expect(
      updateProjectBaseRevisionSchema.parse({ expectedBaseRef: "main", baseRevision: revision }),
    ).toEqual({ expectedBaseRef: "main", baseRevision: revision });
    expect(() => gitCommitShaSchema.parse("main")).toThrow();
    expect(() => gitCommitShaSchema.parse("A".repeat(40))).toThrow();
  });

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
    ).toMatchObject({ environment: {}, writablePaths: [] });
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

  it("rejects writable paths that overlap or target Git metadata", () => {
    const base = {
      schemaVersion: 1 as const,
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
    };
    expect(() =>
      sandboxCommandRequestSchema.parse({ ...base, writablePaths: ["src", "src/file.ts"] }),
    ).toThrow();
    expect(() =>
      sandboxCommandRequestSchema.parse({ ...base, writablePaths: [".git/config"] }),
    ).toThrow();
  });

  it("accepts only bounded official provider onboarding challenges", () => {
    const expiresAt = "2026-10-01T12:10:00.000Z";
    expect(
      providerOnboardingChallengeSchema.parse({
        verificationUri: "https://auth.openai.com/device",
        userCode: "TEST-CODE",
        expiresAt,
      }),
    ).toBeDefined();
    expect(() =>
      providerOnboardingChallengeSchema.parse({
        verificationUri: "https://malicious.example/device",
        userCode: "TEST-CODE",
        expiresAt,
      }),
    ).toThrow();
    expect(
      providerOnboardingJobSchema.parse({
        schemaVersion: 1,
        eventId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        installationId: "codex-main",
        provider: "CODEX",
        expiresAt,
      }),
    ).toBeDefined();
  });

  it("requires stopped source and matching snapshot base for provider handoff", () => {
    const source = runtimeExecutionResultSchema.parse({
      schemaVersion: 1,
      executionId: crypto.randomUUID(),
      provider: "codex",
      status: "FAILED",
      exitCode: 1,
      providerSessionId: null,
      modelRequested: null,
      modelEffective: null,
      finalMessage: null,
      usage: null,
      error: { code: "RATE_LIMITED", message: "limit", retryable: true },
      startedAt: "2026-10-01T12:00:00.000Z",
      finishedAt: "2026-10-01T12:01:00.000Z",
    });
    expect(() =>
      providerHandoffRequestSchema.parse({
        schemaVersion: 1,
        handoffId: crypto.randomUUID(),
        source: {
          executionId: source.executionId,
          provider: source.provider,
          status: source.status,
          errorCode: source.error?.code ?? null,
          finishedAt: source.finishedAt,
        },
        sourceStoppedConfirmed: false,
        targetRole: "REVIEWER",
        repositoryPath: "/srv/repo",
        baseRevision: "a".repeat(40),
        snapshot: {
          artifactPath: "/srv/snapshot",
          manifest: {
            schemaVersion: 1,
            snapshotId: crypto.randomUUID(),
            baseRevision: "b".repeat(40),
            headRevision: "a".repeat(40),
            patchBytes: 0,
            patchSha256: "c".repeat(64),
            untracked: [],
            totalArtifactBytes: 0,
            createdAt: "2026-10-01T12:01:00.000Z",
            manifestHash: "d".repeat(64),
          },
        },
        objective: "Review",
        acceptanceCriteria: ["Safe"],
        configuration: validConfiguration,
        guardState: {
          schemaVersion: 1,
          startedAt: "2026-10-01T12:00:00.000Z",
          attempts: 1,
          providerSwitches: 0,
          lastProvider: "codex",
          lastFailure: null,
        },
        runtimeLimits: { timeoutMs: 1000, maxLogBytes: 4096 },
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

  it("rejects an execution specification that does not match its job envelope", () => {
    const projectId = crypto.randomUUID();
    const ticketId = crypto.randomUUID();
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      projectId,
      ticketId,
      ticketVersion: 2,
      baseRevision: "a".repeat(40),
      projectDefinitionVersion: 3,
      executionSpecification: {
        schemaVersion: 1 as const,
        project: {
          id: projectId,
          name: "Projeto externo",
          repoUrl: "https://example.test/repository.git",
          baseRevision: "a".repeat(40),
          definitionVersion: 3,
          definition: {
            summary: "Projeto configurado",
            externalStack: "Stack externa",
            instructions: "Nao executar deploy.",
            allowedPaths: ["src"],
            forbiddenPaths: ["secrets"],
            checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"] }],
          },
        },
        ticket: {
          id: ticketId,
          version: 2,
          title: "Incremento",
          objective: "Implementar incremento",
          acceptanceCriteria: ["Checks passam"],
        },
      },
    };
    expect(orchestrationJobSchema.parse(job)).toBeDefined();
    expect(() =>
      orchestrationJobSchema.parse({
        ...job,
        executionSpecification: {
          ...job.executionSpecification,
          ticket: { ...job.executionSpecification.ticket, version: 3 },
        },
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
    expect(() =>
      factoryConfigurationSchema.parse({
        ...validConfiguration,
        installations: [
          {
            ...validConfiguration.installations[0],
            models: ["gpt-test", "gpt-test"],
          },
        ],
      }),
    ).toThrow();
  });

  it("validates GitHub verification jobs and fail-closed results", () => {
    expect(
      githubVerificationJobSchema.parse({
        schemaVersion: 1,
        eventId: crypto.randomUUID(),
        verificationId: crypto.randomUUID(),
        host: "github.com",
      }),
    ).toBeDefined();
    expect(() =>
      githubVerificationJobSchema.parse({
        schemaVersion: 1,
        eventId: crypto.randomUUID(),
        verificationId: crypto.randomUUID(),
        host: "github.com",
        token: "must-not-enter-job",
      }),
    ).toThrow();
    expect(() =>
      completeGithubVerificationSchema.parse({
        workerId: crypto.randomUUID(),
        status: "FAILED",
        githubState: "CONNECTED",
        cliVersion: null,
        message: "invalid",
      }),
    ).toThrow();
  });

  it("keeps GitHub onboarding challenges bounded and requires secure completion", () => {
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    expect(
      githubOnboardingChallengeSchema.parse({
        verificationUri: "https://github.com/login/device",
        userCode: "TEST-CODE",
        expiresAt,
      }),
    ).toBeDefined();
    expect(() =>
      githubOnboardingChallengeSchema.parse({
        verificationUri: "https://github.com/settings/tokens",
        userCode: "TEST-CODE",
        expiresAt,
      }),
    ).toThrow();
    expect(() =>
      githubOnboardingJobSchema.parse({
        schemaVersion: 1,
        eventId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        host: "github.com",
        expiresAt,
        token: "must-not-enter-job",
      }),
    ).toThrow();
    expect(() =>
      completeGithubOnboardingSchema.parse({
        workerId: crypto.randomUUID(),
        status: "COMPLETED",
        githubState: "CONNECTED",
        credentialStorage: "PLAINTEXT_FILE",
        message: "invalid",
      }),
    ).toThrow();
  });

  it("validates repository snapshots and requires all-or-nothing read evidence", () => {
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      verificationId: crypto.randomUUID(),
      host: "github.com",
      owner: "fixture-owner",
      repository: "fixture-repository",
      baseBranch: "feature/fixture",
    };
    expect(githubRepositoryVerificationJobSchema.parse(job)).toEqual(job);
    expect(() => githubRepositoryVerificationJobSchema.parse({ ...job, method: "POST" })).toThrow();
    expect(
      completeGithubRepositoryVerificationSchema.parse({
        workerId: crypto.randomUUID(),
        status: "COMPLETED",
        access: "READABLE",
        observedOwner: "fixture-owner",
        observedRepository: "fixture-repository",
        defaultBranch: "main",
        observedBaseBranch: "feature/fixture",
        isPrivate: true,
        isArchived: false,
        message: "Repository and base branch are readable",
      }),
    ).toBeDefined();
    expect(() =>
      completeGithubRepositoryVerificationSchema.parse({
        workerId: crypto.randomUUID(),
        status: "FAILED",
        access: "UNAVAILABLE",
        observedOwner: "leaked-owner",
        observedRepository: null,
        defaultBranch: null,
        observedBaseBranch: null,
        isPrivate: null,
        isArchived: null,
        message: "failed",
      }),
    ).toThrow();
  });

  it("binds pull request jobs to approved immutable fields", () => {
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      approvalDigest: "a".repeat(64),
      host: "github.com",
      owner: "fixture-owner",
      repository: "fixture-repository",
      baseBranch: "main",
      headBranch: "feature/gated-pr",
      title: "Create gated pull request",
      body: "Synthetic body",
      draft: true,
    };
    expect(githubPullRequestJobSchema.parse(job)).toEqual(job);
    expect(() => githubPullRequestJobSchema.parse({ ...job, merge: true })).toThrow();
    expect(() => githubPullRequestJobSchema.parse({ ...job, owner: "owner/other" })).toThrow();
    expect(() => githubPullRequestJobSchema.parse({ ...job, baseBranch: "../main" })).toThrow();
    expect(() =>
      completeGithubPullRequestSchema.parse({
        workerId: crypto.randomUUID(),
        status: "FAILED",
        disposition: "CREATED",
        pullRequestNumber: 1,
        pullRequestUrl: "https://github.com/fixture-owner/fixture-repository/pull/1",
        message: "invalid partial failure",
      }),
    ).toThrow();
  });
});
