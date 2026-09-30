import { z } from "zod";

const workerEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REDIS_URL: z.url().startsWith("redis://"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
  CONTROL_API_URL: z.url(),
  WORKER_API_TOKEN: z.string().min(32),
  WORKER_ID: z.uuid(),
  WORKER_NAME: z.string().trim().min(1).max(120),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
});

export type WorkerConfig = z.infer<typeof workerEnvironmentSchema>;

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return workerEnvironmentSchema.parse(environment);
}
