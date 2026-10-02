import type {
  GithubOnboardingJob,
  GithubPullRequestJob,
  GithubRepositoryVerificationJob,
  GithubVerificationJob,
  ProviderOnboardingJob,
  ProviderVerificationJob,
  WorkerProbeJob,
} from "@le-fabrique/contracts";
import { Worker } from "bullmq";
import { loadWorkerConfig } from "./config";
import { ControlClient, registerWithRetry, startHeartbeat } from "./control-client";
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
import {
  cancelProviderOnboardingProcesses,
  processProviderOnboarding,
} from "./provider-onboarding.processor";
import { processProviderVerification } from "./provider-verification.processor";

async function bootstrap(): Promise<void> {
  const config = loadWorkerConfig();
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
  const providerVerificationWorker = new Worker<ProviderVerificationJob>(
    "le-fabrique.provider-verification",
    async (job) => processProviderVerification(job.data, control),
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
    async (job) => processProviderOnboarding(job.data, control),
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
    stopHeartbeat();
    cancelProviderOnboardingProcesses();
    cancelGithubOnboardingProcesses();
    cancelGithubPullRequestProcesses();
    console.info("worker stopping", { reason });
    await Promise.all([
      probeWorker.close(),
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

void bootstrap().catch((error: unknown) => {
  console.error("worker startup failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
