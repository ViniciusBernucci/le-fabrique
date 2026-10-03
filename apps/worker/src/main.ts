import { createHash } from "node:crypto";
import path from "node:path";
import type {
  FinalizationRecoveryJob,
  GithubOnboardingJob,
  GithubPullRequestJob,
  GithubRepositoryVerificationJob,
  GithubVerificationJob,
  OrchestrationJob,
  ProviderOnboardingJob,
  ProviderVerificationJob,
  WorkerProbeJob,
} from "@le-fabrique/contracts";
import {
  ContextBuilder,
  RuntimeGuard,
  SandboxRunner,
  SnapshotManager,
  WorkspaceManager,
} from "@le-fabrique/runtime";
import { Worker } from "bullmq";
import { ArtifactReader } from "./artifact-reader";
import { loadWorkerConfig } from "./config";
import { ConfiguredAgentRouter } from "./configured-agent-router";
import { ControlClient, registerWithRetry, startHeartbeat } from "./control-client";
import { DeveloperWorkflow } from "./developer-workflow";
import { processFinalizationRecovery, processOrchestrationExecution } from "./execution.processor";
import { createTrustedWorkflowProfile } from "./execution-profile";
import {
  cancelGithubOnboardingProcesses,
  processGithubOnboarding,
} from "./github-onboarding.processor";
import {
  cancelGithubPullRequestProcesses,
  processGithubPullRequest,
} from "./github-pull-request.processor";
import { processGithubRepositoryVerification } from "./github-repository-verification.processor";
import { processGithubVerification } from "./github-verification.processor";
import { type ProbeResult, processProbe } from "./probe.processor";
import { ProviderIdentityManager } from "./provider-identity";
import {
  cancelProviderOnboardingProcesses,
  processProviderOnboarding,
  runCodexDeviceLogin,
} from "./provider-onboarding.processor";
import {
  inspectProvider,
  processProviderVerification,
  runVerificationCommand,
} from "./provider-verification.processor";
import { prepareRepositoryCheckout } from "./repository-checkout";
import { ResultJournal } from "./result-journal";
import { compileWorkflowRequest } from "./workflow-compiler";

async function bootstrap(): Promise<void> {
  const config = loadWorkerConfig();
  const executionConfig = config.WORKER_EXECUTION_ENABLED
    ? requireExecutionConfig(config.WORKER_EXECUTION_ROOT, config.WORKER_CHECKOUT_ROOT)
    : null;
  const control = new ControlClient(config);
  await registerWithRetry(control, {
    maxAttempts: 30,
    delayMs: 1000,
    onRetry: ({ failedAttempt, maxAttempts, delayMs }) =>
      console.warn("worker waiting for control API", {
        failedAttempt,
        maxAttempts,
        retryInMs: delayMs,
      }),
  });

  const redisUrl = new URL(config.REDIS_URL);
  const executionStop = new AbortController();
  const identities = new ProviderIdentityManager(config.WORKER_PROVIDER_ROOT, {
    CODEX: config.WORKER_CODEX_BINARY,
    CLAUDE: config.WORKER_CLAUDE_BINARY,
  });
  const probeWorker = new Worker<WorkerProbeJob, ProbeResult>(
    "le-fabrique.probe",
    async (job) => processProbe(job.data),
    {
      concurrency: config.WORKER_CONCURRENCY,
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number(redisUrl.pathname.slice(1) || 0),
        maxRetriesPerRequest: null,
      },
    },
  );
  const orchestrationWorker = config.WORKER_EXECUTION_ENABLED
    ? new Worker<OrchestrationJob | FinalizationRecoveryJob>(
        "le-fabrique.execution",
        async (job) => {
          if (!executionConfig) throw new Error("Execution consumer configuration is unavailable");
          if ("mode" in job.data)
            return processFinalizationRecovery(job.data, config.WORKER_ID, {
              control,
              journal: new ResultJournal(path.join(executionConfig.root, "result-journal")),
              readArtifact: (snapshot) =>
                new ArtifactReader(path.join(executionConfig.root, "snapshots")).read(snapshot),
            });
          const executionJob = job.data;
          return await processOrchestrationExecution(
            executionJob,
            {
              control,
              journal: new ResultJournal(path.join(executionConfig.root, "result-journal")),
              readArtifact: (snapshot) =>
                new ArtifactReader(path.join(executionConfig.root, "snapshots")).read(snapshot),
              leaseDurationMs: config.WORKER_LEASE_DURATION_MS,
              prepareCheckout: async (payload, claim, signal) => {
                if (!payload.executionSpecification) {
                  throw new Error("Execution job lacks a READY specification");
                }
                return await prepareRepositoryCheckout(
                  {
                    projectId: payload.projectId,
                    workflowId: claim.attemptId,
                    repositoryUrl: payload.executionSpecification.project.repoUrl,
                    baseRevision: payload.executionSpecification.project.baseRevision,
                  },
                  {
                    root: executionConfig.checkoutRoot,
                    allowedHosts: config.WORKER_REPOSITORY_HOSTS,
                  },
                  undefined,
                  signal,
                );
              },
              createProfile: (payload, checkout) => {
                if (!payload.executionSpecification) {
                  throw new Error("Execution job lacks a READY specification");
                }
                return createTrustedWorkflowProfile(payload.executionSpecification, checkout);
              },
              createWorkflow: (profile, specification, workflowId) => {
                const request = compileWorkflowRequest(workflowId, specification, profile);
                const workflow = new DeveloperWorkflow({
                  workspaceManager: new WorkspaceManager(
                    path.join(executionConfig.root, "workspaces"),
                  ),
                  contextBuilder: new ContextBuilder(),
                  guard: new RuntimeGuard(request.guardPolicy),
                  agentRouter: new ConfiguredAgentRouter(control, (route) =>
                    identities.adapter(route),
                  ),
                  sandbox: new SandboxRunner(),
                  snapshots: new SnapshotManager(path.join(executionConfig.root, "snapshots")),
                });
                return {
                  execute: async (signal) => {
                    const resume = executionJob.resumeFrom;
                    if (!resume) return workflow.execute(request, signal);
                    const artifact = await new ArtifactReader(
                      path.join(executionConfig.root, "snapshots"),
                    ).read(resume.snapshot);
                    if (
                      createHash("sha256").update(JSON.stringify(artifact)).digest("hex") !==
                      resume.artifactDigest
                    )
                      throw new Error("Resume artifact digest mismatch");
                    return workflow.execute(request, signal, {
                      artifactPath: path.join(
                        executionConfig.root,
                        "snapshots",
                        resume.snapshot.snapshotId,
                      ),
                      manifest: artifact.manifest,
                    });
                  },
                  cancelActive: () => workflow.cancelActive(),
                };
              },
            },
            executionStop.signal,
          );
        },
        {
          concurrency: 1,
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
            db: Number(redisUrl.pathname.slice(1) || 0),
            maxRetriesPerRequest: null,
          },
        },
      )
    : null;
  const providerVerificationWorker = new Worker<ProviderVerificationJob>(
    "le-fabrique.provider-verification",
    async (job) =>
      processProviderVerification(job.data, control, async (binary, args) =>
        runVerificationCommand(
          binary,
          args,
          await identities.prepare(job.data.provider, job.data.installationId),
        ),
      ),
    {
      concurrency: 1,
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number(redisUrl.pathname.slice(1) || 0),
        maxRetriesPerRequest: null,
      },
    },
  );
  const providerOnboardingWorker = new Worker<ProviderOnboardingJob>(
    "le-fabrique.provider-onboarding",
    async (job) =>
      processProviderOnboarding(
        job.data,
        control,
        async (expiresAt, sink) =>
          runCodexDeviceLogin(
            expiresAt,
            sink,
            await identities.prepare("CODEX", job.data.installationId),
          ),
        async (provider) =>
          inspectProvider(provider, async (binary, args) =>
            runVerificationCommand(
              binary,
              args,
              await identities.prepare(provider, job.data.installationId),
            ),
          ),
      ),
    {
      concurrency: 1,
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number(redisUrl.pathname.slice(1) || 0),
        maxRetriesPerRequest: null,
      },
    },
  );
  const githubVerificationWorker = new Worker<GithubVerificationJob>(
    "le-fabrique.github-verification",
    async (job) => processGithubVerification(job.data, control),
    {
      concurrency: 1,
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number(redisUrl.pathname.slice(1) || 0),
        maxRetriesPerRequest: null,
      },
    },
  );
  const githubOnboardingWorker = new Worker<GithubOnboardingJob>(
    "le-fabrique.github-onboarding",
    async (job) => processGithubOnboarding(job.data, control),
    {
      concurrency: 1,
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number(redisUrl.pathname.slice(1) || 0),
        maxRetriesPerRequest: null,
      },
    },
  );
  const githubRepositoryVerificationWorker = new Worker<GithubRepositoryVerificationJob>(
    "le-fabrique.github-repository-verification",
    async (job) => processGithubRepositoryVerification(job.data, control),
    {
      concurrency: 1,
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number(redisUrl.pathname.slice(1) || 0),
        maxRetriesPerRequest: null,
      },
    },
  );
  const githubPullRequestWorker = new Worker<GithubPullRequestJob>(
    "le-fabrique.github-pull-request",
    async (job) => processGithubPullRequest(job.data, control),
    {
      concurrency: 1,
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number(redisUrl.pathname.slice(1) || 0),
        maxRetriesPerRequest: null,
      },
    },
  );

  let stopping = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    executionStop.abort();
    stopHeartbeat();
    cancelProviderOnboardingProcesses();
    cancelGithubOnboardingProcesses();
    cancelGithubPullRequestProcesses();
    console.info("worker stopping", { reason });
    await Promise.all([
      probeWorker.close(),
      ...(orchestrationWorker ? [orchestrationWorker.close()] : []),
      providerVerificationWorker.close(),
      providerOnboardingWorker.close(),
      githubVerificationWorker.close(),
      githubOnboardingWorker.close(),
      githubRepositoryVerificationWorker.close(),
      githubPullRequestWorker.close(),
    ]);
    process.exit(reason === "control-unavailable" ? 1 : 0);
  };
  const stopHeartbeat = startHeartbeat(
    control,
    config.WORKER_HEARTBEAT_INTERVAL_MS,
    () => void shutdown("control-unavailable"),
  );

  probeWorker.on("ready", () => console.info("worker ready", { workerId: config.WORKER_ID }));
  probeWorker.on("failed", (job, error) =>
    console.error("probe job failed", { jobId: job?.id, error: error.message }),
  );
  orchestrationWorker?.on("failed", (job, error) =>
    console.error("orchestration execution failed", {
      jobId: job?.id,
      errorName: error.name,
    }),
  );
  providerVerificationWorker.on("failed", (job, error) =>
    console.error("provider verification failed", { jobId: job?.id, error: error.message }),
  );
  providerOnboardingWorker.on("failed", (job, error) =>
    console.error("provider onboarding failed", { jobId: job?.id, error: error.message }),
  );
  githubVerificationWorker.on("failed", (job, error) =>
    console.error("GitHub verification failed", { jobId: job?.id, error: error.message }),
  );
  githubOnboardingWorker.on("failed", (job, error) =>
    console.error("GitHub onboarding failed", { jobId: job?.id, error: error.message }),
  );
  githubRepositoryVerificationWorker.on("failed", (job, error) =>
    console.error("GitHub repository verification failed", {
      jobId: job?.id,
      error: error.message,
    }),
  );
  githubPullRequestWorker.on("failed", (job, error) =>
    console.error("GitHub pull request failed", { jobId: job?.id, error: error.message }),
  );
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

function requireExecutionConfig(
  root: string | undefined,
  checkoutRoot: string | undefined,
): { root: string; checkoutRoot: string } {
  if (!root || !checkoutRoot) {
    throw new Error("Real execution requires explicit worker and checkout roots");
  }
  return { root, checkoutRoot };
}

void bootstrap().catch((error: unknown) => {
  console.error("worker startup failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
