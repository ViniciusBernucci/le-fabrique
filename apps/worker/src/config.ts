import path from "node:path";
import { z } from "zod";

const workerEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    REDIS_URL: z.url().startsWith("redis://"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
    CONTROL_API_URL: z.url(),
    WORKER_API_TOKEN: z.string().min(32),
    WORKER_ID: z.uuid(),
    WORKER_NAME: z.string().trim().min(1).max(120),
    WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
    WORKER_EXECUTION_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    WORKER_EXECUTION_ROOT: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .refine((root) => path.isAbsolute(root) && path.resolve(root) !== path.parse(root).root)
      .optional(),
    WORKER_PROVIDER_ROOT: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .refine((root) => path.isAbsolute(root) && path.resolve(root) !== path.parse(root).root)
      .optional(),
    WORKER_CHECKOUT_ROOT: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .refine((root) => path.isAbsolute(root), "WORKER_CHECKOUT_ROOT must be absolute")
      .optional(),
    WORKER_REPOSITORY_HOSTS: z
      .string()
      .trim()
      .max(4096)
      .default("")
      .transform(parseRepositoryHosts),
    WORKER_CODEX_BINARY: z.string().trim().min(1).max(4096).default("/usr/bin/codex"),
    WORKER_CLAUDE_BINARY: z.string().trim().min(1).max(4096).default("/usr/bin/claude"),
    WORKER_LEASE_DURATION_MS: z.coerce.number().int().min(15_000).max(300_000).default(90_000),
  })
  .superRefine((config, context) => {
    if (config.WORKER_PROVIDER_ROOT) {
      const providerRoot = path.resolve(config.WORKER_PROVIDER_ROOT);
      for (const other of [config.WORKER_EXECUTION_ROOT, config.WORKER_CHECKOUT_ROOT]) {
        if (!other) continue;
        const otherRoot = path.resolve(other);
        if (
          providerRoot === otherRoot ||
          providerRoot.startsWith(`${otherRoot}${path.sep}`) ||
          otherRoot.startsWith(`${providerRoot}${path.sep}`)
        ) {
          context.addIssue({
            code: "custom",
            path: ["WORKER_PROVIDER_ROOT"],
            message: "Provider root must be separate from code and execution",
          });
        }
      }
    }
    if (!config.WORKER_EXECUTION_ENABLED) return;
    if (!config.WORKER_PROVIDER_ROOT)
      context.addIssue({
        code: "custom",
        path: ["WORKER_PROVIDER_ROOT"],
        message: "Required when real execution is enabled",
      });
    if (!config.WORKER_EXECUTION_ROOT) {
      context.addIssue({
        code: "custom",
        path: ["WORKER_EXECUTION_ROOT"],
        message: "Required when real execution is enabled",
      });
    }
    if (!config.WORKER_CHECKOUT_ROOT) {
      context.addIssue({
        code: "custom",
        path: ["WORKER_CHECKOUT_ROOT"],
        message: "Required when real execution is enabled",
      });
    }
    if (config.WORKER_REPOSITORY_HOSTS.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["WORKER_REPOSITORY_HOSTS"],
        message: "At least one exact Git host is required when real execution is enabled",
      });
    }
    if (config.WORKER_EXECUTION_ROOT && config.WORKER_CHECKOUT_ROOT) {
      const executionRoot = path.resolve(config.WORKER_EXECUTION_ROOT);
      const checkoutRoot = path.resolve(config.WORKER_CHECKOUT_ROOT);
      if (
        executionRoot === checkoutRoot ||
        executionRoot.startsWith(`${checkoutRoot}${path.sep}`) ||
        checkoutRoot.startsWith(`${executionRoot}${path.sep}`)
      ) {
        context.addIssue({
          code: "custom",
          path: ["WORKER_CHECKOUT_ROOT"],
          message: "Checkout and execution roots must be separate directories",
        });
      }
    }
    if (
      !path.isAbsolute(config.WORKER_CODEX_BINARY) ||
      !path.isAbsolute(config.WORKER_CLAUDE_BINARY)
    ) {
      context.addIssue({
        code: "custom",
        path: ["WORKER_CODEX_BINARY"],
        message: "Provider CLI paths must be absolute",
      });
    }
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
