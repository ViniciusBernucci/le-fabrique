import type { WorkerProbeJob } from "@le-fabrique/contracts";
import { Worker } from "bullmq";
import { loadWorkerConfig } from "./config";
import { type ProbeResult, processProbe } from "./probe.processor";

const config = loadWorkerConfig();
const redisUrl = new URL(config.REDIS_URL);

const worker = new Worker<WorkerProbeJob, ProbeResult>(
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

worker.on("ready", () => {
  console.info("worker ready");
});

worker.on("failed", (job, error) => {
  console.error("probe job failed", { jobId: job?.id, error: error.message });
});

async function shutdown(signal: string): Promise<void> {
  console.info("worker stopping", { signal });
  await worker.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
