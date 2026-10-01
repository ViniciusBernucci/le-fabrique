import type {
  GithubVerificationJob,
  OrchestrationJob,
  ProviderOnboardingJob,
  ProviderVerificationJob,
  WorkerProbeJob,
} from "@le-fabrique/contracts";
import { Worker } from "bullmq";
import { loadWorkerConfig } from "./config";
import { ControlClient, startHeartbeat } from "./control-client";
import { processGithubVerification } from "./github-verification.processor";
import { processOrchestrationFixture } from "./orchestration.processor";
import { type ProbeResult, processProbe } from "./probe.processor";
import {
  cancelProviderOnboardingProcesses,
  processProviderOnboarding,
} from "./provider-onboarding.processor";
import { processProviderVerification } from "./provider-verification.processor";

async function bootstrap(): Promise<void> {
  const config = loadWorkerConfig();
  const control = new ControlClient(config);
  await control.register();

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
  const orchestrationWorker = new Worker<OrchestrationJob, { runId: string; attemptId: string }>(
    "le-fabrique.execution",
    async (job) => processOrchestrationFixture(job.data, control),
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

  let stopping = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    stopHeartbeat();
    cancelProviderOnboardingProcesses();
    console.info("worker stopping", { reason });
    await Promise.all([
      probeWorker.close(),
      orchestrationWorker.close(),
      providerVerificationWorker.close(),
      providerOnboardingWorker.close(),
      githubVerificationWorker.close(),
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
  orchestrationWorker.on("failed", (job, error) =>
    console.error("orchestration probe failed", { jobId: job?.id, error: error.message }),
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
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap().catch((error: unknown) => {
  console.error("worker startup failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
