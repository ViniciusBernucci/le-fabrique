import { z } from "zod";

export const serviceNameSchema = z.enum(["api", "database", "redis", "worker"]);
export type ServiceName = z.infer<typeof serviceNameSchema>;

export const healthStatusSchema = z.enum(["ok", "error"]);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  service: serviceNameSchema,
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readinessResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.literal("api"),
  timestamp: z.iso.datetime(),
  checks: z.object({
    database: healthStatusSchema,
    redis: healthStatusSchema,
  }),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

export const workerProbeJobSchema = z.object({
  requestedAt: z.iso.datetime(),
  correlationId: z.uuid(),
});
export type WorkerProbeJob = z.infer<typeof workerProbeJobSchema>;
