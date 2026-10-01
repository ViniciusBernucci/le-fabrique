import type { OrchestrationJob, WorkerProbeJob } from "@le-fabrique/contracts";
import { Worker } from "bullmq";
import { loadWorkerConfig } from "./config";
import { ControlClient, startHeartbeat } from "./control-client";
import { processOrchestrationFixture } from "./orchestration.processor";
import { type ProbeResult, processProbe } from "./probe.processor";

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

  let stopping = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    stopHeartbeat();
    console.info("worker stopping", { reason });
    await Promise.all([probeWorker.close(), orchestrationWorker.close()]);
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
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap().catch((error: unknown) => {
  console.error("worker startup failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
