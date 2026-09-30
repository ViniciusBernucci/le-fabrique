import { z } from "zod";

const workerEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REDIS_URL: z.url().startsWith("redis://"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
});

export type WorkerConfig = z.infer<typeof workerEnvironmentSchema>;

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return workerEnvironmentSchema.parse(environment);
}
