import path from "node:path";
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
  WORKER_CHECKOUT_ROOT: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .refine((root) => path.isAbsolute(root), "WORKER_CHECKOUT_ROOT must be absolute")
    .optional(),
  WORKER_REPOSITORY_HOSTS: z.string().trim().max(4096).default("").transform(parseRepositoryHosts),
});

export type WorkerConfig = z.infer<typeof workerEnvironmentSchema>;

export function parseRepositoryHosts(value: string): string[] {
  const hosts = value
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    hosts.some(
      (host) =>
        host.includes("*") ||
        host.includes(":") ||
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
        !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host),
    ) ||
    new Set(hosts).size !== hosts.length
  ) {
    throw new Error("WORKER_REPOSITORY_HOSTS must contain unique public DNS hostnames");
  }
  return hosts;
}

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return workerEnvironmentSchema.parse(environment);
}
