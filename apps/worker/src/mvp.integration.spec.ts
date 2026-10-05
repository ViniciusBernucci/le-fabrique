import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ExecutionArtifact,
  ExecutionResultReport,
  OrchestrationJob,
  OrchestrationState,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
} from "@le-fabrique/contracts";
import {
  executionResultReportSchema,
  orchestrationJobSchema,
  verifyExecutionArtifact,
  workspaceSnapshotManifestSchema,
} from "@le-fabrique/contracts";
import {
  ContextBuilder,
  RuntimeGuard,
  SandboxRunner,
  SnapshotManager,
  WorkspaceManager,
} from "@le-fabrique/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactReader } from "./artifact-reader";
import { DeveloperWorkflow } from "./developer-workflow";
import {
  type ExecutionProcessorDependencies,
  processOrchestrationExecution,
} from "./execution.processor";
import { createTrustedWorkflowProfile } from "./execution-profile";
import { ResultJournal } from "./result-journal";
import { compileWorkflowRequest } from "./workflow-compiler";

const exec = promisify(execFile);
const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(writeDocumentation = true) {
  const root = await mkdtemp(path.join(tmpdir(), "fac-012ab-integrated-"));
  roots.push(root);
  const repository = path.join(root, "repository");
  await mkdir(path.join(repository, "src"), { recursive: true });
  await mkdir(path.join(repository, "docs"));
  await writeFile(
    path.join(repository, "README.md"),
    "# Synthetic project\nValue starts at zero.\n",
  );
  await writeFile(path.join(repository, "docs/index.md"), "# Documentation\nSynthetic fixture.\n");
  await writeFile(path.join(repository, "src/value.cjs"), "module.exports = 0;\n");
  await writeFile(
    path.join(repository, "src/check.cjs"),
    'const value = require("./value.cjs"); if (!Number.isInteger(value)) process.exit(1); console.log("MEASURED_VALUE=" + value);\n',
  );
  await exec("/usr/bin/git", ["init", repository]);
  await exec("/usr/bin/git", ["-C", repository, "add", "."]);
  await exec("/usr/bin/git", [
    "-C",
    repository,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-m",
    "synthetic baseline",
  ]);
  const revision = (
    await exec("/usr/bin/git", ["-C", repository, "rev-parse", "HEAD"])
  ).stdout.trim();
  const projectId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const workerId = crypto.randomUUID();
  const job: OrchestrationJob = orchestrationJobSchema.parse({
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    ticketId,
    projectId,
    ticketVersion: 1,
    baseRevision: revision,
    projectDefinitionVersion: 1,
    executionSpecification: {
      schemaVersion: 1,
      project: {
        id: projectId,
        name: "Synthetic integration",
        repoUrl: "https://example.test/synthetic.git",
        baseRevision: revision,
        definitionVersion: 1,
        definition: {
          summary: "Synthetic fixture",
          externalStack: "Node fixture",
          instructions: "No real provider or remote calls",
          allowedPaths: ["src", "README.md", "docs"],
          forbiddenPaths: [],
          checks: [{ name: "unit", command: process.execPath, args: ["/mnt/src/check.cjs"] }],
          executionProfile: {
            contextSources: [
              { path: "README.md", role: "INSTRUCTION" },
              { path: "src/value.cjs", role: "SOURCE" },
            ],
            approvedChecks: [
              { name: "unit", command: process.execPath, args: ["/mnt/src/check.cjs"] },
            ],
            documentation: {
              requiredFiles: ["README.md", "docs/delivery.md"],
              reportPath: "docs/delivery.md",
              requiredSections: ["Funcionamento", "Verificação", "Rollback"],
            },
          },
        },
      },
      ticket: {
        id: ticketId,
        version: 1,
        title: "Synthetic increment",
        objective: "Change value from zero to one",
        acceptanceCriteria: ["Value equals one", "Documentation updated"],
      },
    },
  });
  const workspaceManager = new WorkspaceManager(path.join(root, "workspaces"));
  const snapshots = new SnapshotManager(path.join(root, "snapshots"));
  const artifactReader = new ArtifactReader(path.join(root, "snapshots"));
  const journal = new ResultJournal(path.join(root, "journal"));
  const sandboxRunner = new SandboxRunner();
  const measuredChecks: Awaited<ReturnType<SandboxRunner["execute"]>>[] = [];
  const check = vi.fn(
    async (input: Parameters<SandboxRunner["execute"]>[0], signal?: AbortSignal) => {
      const result = await sandboxRunner.execute(input, signal);
      measuredChecks.push(result);
      return result;
    },
  );
  const executeAdapter = vi.fn(
    async (
      role: "DEVELOPER" | "REVIEWER",
      request: RuntimeExecutionRequest,
    ): Promise<RuntimeExecutionResult> => {
      let finalMessage = "Synthetic implementation complete";
      if (role === "DEVELOPER") {
        await writeFile(path.join(request.workspacePath, "src/value.cjs"), "module.exports = 1;\n");
        if (writeDocumentation) {
          await writeFile(
            path.join(request.workspacePath, "README.md"),
            "# Synthetic project\nValue equals one; see docs/delivery.md.\n",
          );
          await writeFile(
            path.join(request.workspacePath, "docs/delivery.md"),
            `# Synthetic delivery\nBase ${revision}\n## Funcionamento\nValue updated to one.\n## Verificação\nunit is measured by supervisor; consult the bound result for baseline/post outcomes.\n## Rollback\nRestore the baseline after stopping the writer.\n`,
          );
        }
      } else {
        expect(await readFile(path.join(request.workspacePath, "src/value.cjs"), "utf8")).toBe(
          "module.exports = 1;\n",
        );
        expect(
          await readFile(path.join(request.workspacePath, "docs/delivery.md"), "utf8"),
        ).toContain(revision);
        expect(request.permissionMode).toBe("READ_ONLY");
        expect(request.writablePaths).toEqual([]);
        finalMessage = JSON.stringify({
          schemaVersion: 1,
          verdict: "APPROVE",
          summary: "Synthetic deterministic reviewer verified value/documents",
          findings: [],
        });
      }
      const timestamp = new Date().toISOString();
      return {
        schemaVersion: 1,
        executionId: request.executionId,
        provider: "codex",
        status: "COMPLETED",
        exitCode: 0,
        providerSessionId: null,
        modelRequested: request.modelRequested,
        modelEffective: "synthetic-adapter",
        finalMessage,
        usage: null,
        error: null,
        startedAt: timestamp,
        finishedAt: timestamp,
      };
    },
  );
  const control = {
    claim: vi.fn(async () => ({
      runId,
      attemptId,
      workerId,
      fencingToken: 1,
      leaseExpiresAt: new Date(Date.now() + 90_000).toISOString(),
      replayed: false,
    })),
    renew: vi.fn(async () => ({
      runId,
      attemptId,
      workerId,
      fencingToken: 1,
      replayed: false,
      leaseExpiresAt: new Date(Date.now() + 90_000).toISOString(),
    })),
    reportResult: vi.fn(async (_id: string, input: { result: ExecutionResultReport }) => {
      const result = executionResultReportSchema.parse(input.result);
      return { attemptId, digest: hash(JSON.stringify(result)) };
    }),
    reportArtifact: vi.fn(async (_id: string, _fence: number, artifact: ExecutionArtifact) => {
      verifyExecutionArtifact(artifact, (encoded) => Buffer.from(encoded, "base64"), hash);
      return { attemptId, digest: hash(JSON.stringify(artifact)) };
    }),
    checkpoint: vi.fn(async () => ({
      runId,
      attemptId,
      status: "RUNNING" as const,
      stoppedConfirmed: true,
    })),
    complete: vi.fn(async (_id: string, input: { outcome: OrchestrationState["status"] }) => ({
      runId,
      attemptId,
      status: input.outcome,
      stoppedConfirmed: true,
    })),
    reconcile: vi.fn(async () => ({ state: null })),
  };
  const dependencies: ExecutionProcessorDependencies = {
    journal,
    readArtifact: (snapshot) => artifactReader.read(snapshot),
    control,
    leaseDurationMs: 90_000,
    prepareCheckout: vi.fn(async () => ({
      path: repository,
      projectId,
      workflowId: attemptId,
      repositoryUrl: "https://example.test/synthetic.git",
      baseRevision: revision,
    })),
    createProfile: (payload, checkout) => {
      if (!payload.executionSpecification) throw new Error("Missing fixture specification");
      const profile = createTrustedWorkflowProfile(payload.executionSpecification, checkout);
      profile.maxCorrectionRounds = 0;
      profile.sandboxLimits = {
        ...profile.sandboxLimits,
        timeoutMs: 10_000,
        memoryBytes: 268_435_456,
        cpuQuotaPercent: 100,
        maxProcesses: 64,
      };
      return profile;
    },
    createWorkflow: (profile, specification, workflowId) => {
      const request = compileWorkflowRequest(workflowId, specification, profile);
      const workflow = new DeveloperWorkflow({
        workspaceManager,
        snapshots,
        contextBuilder: new ContextBuilder(),
        guard: new RuntimeGuard(request.guardPolicy),
        sandbox: { execute: check },
        agentRouter: {
          resolve: async (role, excludedInstallations = []) => {
            if (role !== "DEVELOPER" && role !== "REVIEWER")
              throw new Error("Unsupported fixture role");
            return {
              route: {
                role,
                installationId: excludedInstallations.length
                  ? "synthetic-alternative"
                  : "synthetic-account",
                provider: "codex",
                model: "synthetic-model",
                permissionMode: role === "DEVELOPER" ? "WORKSPACE_WRITE" : "READ_ONLY",
              },
              adapter: {
                name: "codex",
                execute: (input) => executeAdapter(role, input),
                cancel: async (executionId) => ({ executionId, status: "NOT_FOUND" }),
                getStatus: async () => ({
                  provider: "codex",
                  state: "ERROR",
                  authMode: "chatgpt",
                  observedAt: new Date().toISOString(),
                  cliVersion: "synthetic-adapter",
                }),
                getCapabilities: async () => [],
                getUsage: async () => ({
                  provider: "codex",
                  state: "UNKNOWN",
                  value: null,
                  unit: null,
                  resetAt: null,
                  observedAt: new Date().toISOString(),
                  source: "client-not-exposed",
                }),
              },
              maxAttempts: 2,
              timeoutMs: 60_000,
              configurationVersion: 1,
              configurationObservedAt: new Date().toISOString(),
            };
          },
        },
      });
      return {
        execute: (signal) => workflow.execute(request, signal),
        cancelActive: () => workflow.cancelActive(),
      };
    },
  };
  return {
    root,
    repository,
    revision,
    attemptId,
    job,
    dependencies,
    journal,
    snapshots,
    workspaceManager,
    artifactReader,
    executeAdapter,
    measuredChecks,
    check,
    control,
  };
}

describe("integrated internal MVP rehearsal with real Git, Linux sandbox and artifact storage", () => {
  it("measures baseline/post checks, binds documentation to the delivered bundle and restores bytes", async () => {
    const f = await fixture();
    const outcome = await processOrchestrationExecution(f.job, f.dependencies);
    expect(outcome.status).toBe("VALIDATING");
    expect(f.measuredChecks.map((entry) => entry.stdout.trim())).toEqual([
      "MEASURED_VALUE=0",
      "MEASURED_VALUE=1",
    ]);
    expect(f.measuredChecks.every((entry) => entry.stoppedConfirmed && entry.exitCode === 0)).toBe(
      true,
    );
    const intent = await f.journal.load(f.job);
    if (!intent) throw new Error("Missing real journal evidence");
    const latest = intent.result.snapshots.at(-1);
    if (!latest) throw new Error("Missing real snapshot");
    expect(intent.result.documentation?.snapshotHash).toBe(latest.manifestHash);
    expect(intent.result.documentation?.status).toBe("PASS");
    const artifact = await f.artifactReader.read(latest);
    const reportBytes = Buffer.from(
      artifact.files.find((file) => file.path === "docs/delivery.md")?.dataBase64 ?? "",
      "base64",
    );
    expect(hash(reportBytes)).toBe(
      intent.result.documentation?.files.find((file) => file.path === "docs/delivery.md")?.sha256,
    );
    const artifactPath = path.join(f.root, "snapshots", latest.snapshotId);
    const manifest = workspaceSnapshotManifestSchema.parse(
      JSON.parse(await readFile(path.join(artifactPath, "manifest.json"), "utf8")),
    );
    const restored = await f.workspaceManager.create({
      executionId: crypto.randomUUID(),
      repositoryPath: f.repository,
      revision: f.revision,
    });
    await f.snapshots.restore({ artifactPath, manifest }, restored.workspacePath);
    expect(await readFile(path.join(restored.workspacePath, "src/value.cjs"), "utf8")).toBe(
      "module.exports = 1;\n",
    );
    expect(await readFile(path.join(restored.workspacePath, "docs/delivery.md"))).toEqual(
      reportBytes,
    );
    expect(hash(await readFile(path.join(restored.workspacePath, "README.md")))).toBe(
      intent.result.documentation?.files.find((file) => file.path === "README.md")?.sha256,
    );
  }, 30_000);

  it("recovers from upload failure using the real journal without another writer or check", async () => {
    const f = await fixture();
    f.control.reportArtifact.mockRejectedValueOnce(new Error("synthetic upload interruption"));
    await expect(processOrchestrationExecution(f.job, f.dependencies)).rejects.toThrow(
      "synthetic upload interruption",
    );
    expect(await f.journal.load(f.job)).not.toBeNull();
    expect(f.control.checkpoint).not.toHaveBeenCalled();
    const callsBeforeRecovery = f.executeAdapter.mock.calls.length;
    const checksBeforeRecovery = f.check.mock.calls.length;
    const recovered = await processOrchestrationExecution(f.job, f.dependencies);
    expect(recovered).toMatchObject({ status: "VALIDATING", replayed: true });
    expect(f.executeAdapter).toHaveBeenCalledTimes(callsBeforeRecovery);
    expect(f.check).toHaveBeenCalledTimes(checksBeforeRecovery);
    expect(f.control.claim).toHaveBeenCalledTimes(1);
    expect(f.control.complete).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("restores a real snapshot and refreshes context when a stopped synthetic provider becomes unavailable", async () => {
    const f = await fixture();
    const original = f.executeAdapter.getMockImplementation();
    f.executeAdapter.mockImplementationOnce(async (role, request) => {
      if (!original) throw new Error("Missing synthetic adapter");
      const completed = await original(role, request);
      return {
        ...completed,
        status: "FAILED",
        exitCode: 1,
        finalMessage: null,
        error: { code: "RATE_LIMITED", message: "Synthetic stopped quota event", retryable: true },
      };
    });
    const result = await processOrchestrationExecution(f.job, f.dependencies);
    expect(result.status).toBe("VALIDATING");
    expect(f.executeAdapter.mock.calls.map(([role]) => role)).toEqual([
      "DEVELOPER",
      "DEVELOPER",
      "REVIEWER",
    ]);
    const origin = f.executeAdapter.mock.calls[0]?.[1];
    const destination = f.executeAdapter.mock.calls[1]?.[1];
    expect(destination?.workspacePath).not.toBe(origin?.workspacePath);
    expect(destination?.prompt).toContain("module.exports = 1;");
    const intent = await f.journal.load(f.job);
    expect(intent?.result.corrections).toBe(0);
    expect(intent?.result.handoffs).toHaveLength(1);
    expect(intent?.result.handoffs?.[0]).toMatchObject({
      fromInstallationId: "synthetic-account",
      toInstallationId: "synthetic-alternative",
      reason: "RATE_LIMITED",
    });
    expect(f.measuredChecks).toHaveLength(2);
  }, 30_000);

  it("blocks finalization of a corrupted saved bundle without starting another writer", async () => {
    const f = await fixture();
    f.control.reportArtifact.mockRejectedValueOnce(new Error("synthetic upload interruption"));
    await expect(processOrchestrationExecution(f.job, f.dependencies)).rejects.toThrow(
      "synthetic upload interruption",
    );
    const intent = await f.journal.load(f.job);
    const snapshot = intent?.result.snapshots.at(-1);
    if (!snapshot) throw new Error("Missing preserved snapshot");
    const patchPath = path.join(f.root, "snapshots", snapshot.snapshotId, "tracked.patch");
    await writeFile(
      patchPath,
      Buffer.concat([await readFile(patchPath), Buffer.from("corrupted")]),
    );
    await expect(processOrchestrationExecution(f.job, f.dependencies)).rejects.toThrow(
      "integrity mismatch",
    );
    expect(f.executeAdapter).toHaveBeenCalledTimes(2);
    expect(f.check).toHaveBeenCalledTimes(2);
    expect(f.control.claim).toHaveBeenCalledTimes(1);
    expect(f.control.checkpoint).not.toHaveBeenCalled();
    expect(f.control.complete).not.toHaveBeenCalled();
    expect(await f.journal.load(f.job)).not.toBeNull();
  }, 30_000);

  it("preserves incomplete documentation without reviewer or approved completion", async () => {
    const f = await fixture(false);
    const result = await processOrchestrationExecution(f.job, f.dependencies);
    expect(result).toMatchObject({ status: "PAUSED_LIMIT", reason: "DOCUMENTATION_INCOMPLETE" });
    expect(f.executeAdapter).toHaveBeenCalledTimes(1);
    const intent = await f.journal.load(f.job);
    expect(intent?.result.documentation?.status).toBe("FAIL");
    expect(intent?.result.review).toBeNull();
    expect(intent?.checkpoint.stoppedConfirmed).toBe(true);
    expect(intent?.result.snapshots).toHaveLength(1);
  }, 30_000);
});
