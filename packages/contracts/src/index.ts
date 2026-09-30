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

export const ticketStatusSchema = z.enum([
  "DRAFT",
  "READY",
  "WAITING_WORKER",
  "RUNNING",
  "VALIDATING",
  "REVIEW",
  "DOCS",
  "AWAITING_HUMAN",
  "DONE",
  "WAITING_PROVIDER",
  "PAUSED_LIMIT",
  "PAUSED_RESOURCE",
  "BLOCKED_RECOVERY",
  "AUTH_REQUIRED",
  "FAILED",
  "CANCELLED",
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const adminSessionSchema = z.object({ authenticated: z.literal(true) });
export type AdminSession = z.infer<typeof adminSessionSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  repoUrl: z.url(),
  baseRef: z.string().trim().min(1).max(200),
});
export type CreateProject = z.infer<typeof createProjectSchema>;

export const projectSchema = createProjectSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Project = z.infer<typeof projectSchema>;
export const projectListSchema = z.array(projectSchema);

export const createTicketSchema = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(4000),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
});
export type CreateTicket = z.infer<typeof createTicketSchema>;

export const ticketSchema = createTicketSchema.extend({
  id: z.uuid(),
  projectId: z.uuid(),
  status: ticketStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Ticket = z.infer<typeof ticketSchema>;
export const ticketListSchema = z.array(ticketSchema);

export const readyTicketSchema = z.object({ expectedVersion: z.number().int().positive() });
export type ReadyTicket = z.infer<typeof readyTicketSchema>;
