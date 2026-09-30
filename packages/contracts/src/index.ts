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

export const workerRegistrationSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  capabilities: z.array(z.string().trim().min(1).max(120)).max(50),
  os: z.string().trim().min(1).max(80),
  arch: z.string().trim().min(1).max(40),
  nodeVersion: z.string().trim().min(1).max(40),
});
export type WorkerRegistration = z.infer<typeof workerRegistrationSchema>;

export const workerStatusSchema = z.enum(["ONLINE", "OFFLINE"]);
export const workerSchema = workerRegistrationSchema.extend({
  status: workerStatusSchema,
  lastHeartbeatAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WorkerIdentity = z.infer<typeof workerSchema>;
export const workerListSchema = z.array(workerSchema);
export const workerHeartbeatSchema = z.object({
  workerId: z.uuid(),
  acceptedAt: z.iso.datetime(),
});
export type WorkerHeartbeat = z.infer<typeof workerHeartbeatSchema>;

export const runtimePermissionModeSchema = z.enum(["READ_ONLY", "WORKSPACE_WRITE"]);
export type RuntimePermissionMode = z.infer<typeof runtimePermissionModeSchema>;

export const runtimeLimitsSchema = z.object({
  timeoutMs: z.number().int().min(100).max(1_800_000),
  maxLogBytes: z
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024),
});
export type RuntimeLimits = z.infer<typeof runtimeLimitsSchema>;

export const runtimeExecutionRequestSchema = z.object({
  schemaVersion: z.literal(1),
  executionId: z.uuid(),
  workspacePath: z.string().trim().min(1).max(4096),
  prompt: z.string().trim().min(1).max(200_000),
  permissionMode: runtimePermissionModeSchema,
  modelRequested: z.string().trim().min(1).max(120).nullable().default(null),
  limits: runtimeLimitsSchema,
});
export type RuntimeExecutionRequest = z.infer<typeof runtimeExecutionRequestSchema>;

export const runtimeUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  reasoningOutputTokens: z.number().int().nonnegative(),
});
export type RuntimeUsage = z.infer<typeof runtimeUsageSchema>;

export const runtimeErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "RATE_LIMITED",
  "CONTEXT_TOO_LARGE",
  "TOOL_DENIED",
  "TIMEOUT",
  "CANCELLED",
  "LOG_LIMIT",
  "PROVIDER_BUSY",
  "TRANSIENT",
  "RESULT_UNKNOWN",
  "UNSUPPORTED",
]);
export type RuntimeErrorCode = z.infer<typeof runtimeErrorCodeSchema>;

export const runtimeErrorSchema = z.object({
  code: runtimeErrorCodeSchema,
  message: z.string().trim().min(1).max(500),
  retryable: z.boolean(),
});
export type RuntimeError = z.infer<typeof runtimeErrorSchema>;

export const runtimeExecutionStatusSchema = z.enum([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
]);
export type RuntimeExecutionStatus = z.infer<typeof runtimeExecutionStatusSchema>;

export const runtimeExecutionResultSchema = z.object({
  schemaVersion: z.literal(1),
  executionId: z.uuid(),
  provider: z.literal("codex"),
  status: runtimeExecutionStatusSchema,
  exitCode: z.number().int().nullable(),
  providerSessionId: z.string().min(1).max(200).nullable(),
  modelRequested: z.string().min(1).max(120).nullable(),
  modelEffective: z.string().min(1).max(120).nullable(),
  finalMessage: z.string().max(200_000).nullable(),
  usage: runtimeUsageSchema.nullable(),
  error: runtimeErrorSchema.nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
});
export type RuntimeExecutionResult = z.infer<typeof runtimeExecutionResultSchema>;

export const runtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    executionId: z.uuid(),
    timestamp: z.iso.datetime(),
  }),
  z.object({
    type: z.literal("progress"),
    executionId: z.uuid(),
    timestamp: z.iso.datetime(),
    category: z.enum(["agent_message", "command", "file_change", "tool"]),
  }),
  z.object({
    type: z.literal("usage_observed"),
    executionId: z.uuid(),
    timestamp: z.iso.datetime(),
    usage: runtimeUsageSchema,
  }),
  z.object({
    type: z.literal("process_exited"),
    executionId: z.uuid(),
    timestamp: z.iso.datetime(),
    exitCode: z.number().int().nullable(),
  }),
  z.object({
    type: z.literal("finished"),
    executionId: z.uuid(),
    timestamp: z.iso.datetime(),
    status: runtimeExecutionStatusSchema,
  }),
]);
export type RuntimeEvent = z.infer<typeof runtimeEventSchema>;

export const runtimeCancelResultSchema = z.object({
  executionId: z.uuid(),
  status: z.enum(["CANCELLED", "NOT_FOUND"]),
});
export type RuntimeCancelResult = z.infer<typeof runtimeCancelResultSchema>;

export const providerStateSchema = z.enum([
  "AVAILABLE",
  "AUTH_REQUIRED",
  "RATE_LIMITED",
  "ERROR",
  "DISABLED",
]);
export type ProviderState = z.infer<typeof providerStateSchema>;

export const providerStatusSchema = z.object({
  provider: z.literal("codex"),
  state: providerStateSchema,
  authMode: z.literal("chatgpt"),
  observedAt: z.iso.datetime(),
  cliVersion: z.string().min(1).max(120).nullable(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const providerUsageObservationSchema = z.object({
  provider: z.literal("codex"),
  state: z.literal("UNKNOWN"),
  value: z.null(),
  unit: z.null(),
  resetAt: z.null(),
  observedAt: z.iso.datetime(),
  source: z.literal("client-not-exposed"),
});
export type ProviderUsageObservation = z.infer<typeof providerUsageObservationSchema>;

export const contextSourceRoleSchema = z.enum([
  "INSTRUCTION",
  "TICKET",
  "SPECIFICATION",
  "ARCHITECTURE",
  "SOURCE",
  "TEST",
  "FINDING",
]);
export type ContextSourceRole = z.infer<typeof contextSourceRoleSchema>;

export const contextSourceRequestSchema = z.object({
  path: z.string().trim().min(1).max(4096),
  role: contextSourceRoleSchema,
});
export type ContextSourceRequest = z.infer<typeof contextSourceRequestSchema>;

export const contextLimitsSchema = z.object({
  maxFiles: z.number().int().min(1).max(500),
  maxFileBytes: z
    .number()
    .int()
    .min(1)
    .max(2 * 1024 * 1024),
  maxTotalBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
});
export type ContextLimits = z.infer<typeof contextLimitsSchema>;

export const contextBuildRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspacePath: z.string().trim().min(1).max(4096),
    baseRevision: z.string().regex(/^[0-9a-f]{7,64}$/i),
    sources: z.array(contextSourceRequestSchema).min(1).max(500),
    limits: contextLimitsSchema,
  })
  .superRefine((request, context) => {
    const paths = new Set<string>();
    for (const source of request.sources) {
      if (paths.has(source.path)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate context path: ${source.path}`,
          path: ["sources"],
        });
      }
      paths.add(source.path);
    }
  });
export type ContextBuildRequest = z.infer<typeof contextBuildRequestSchema>;

export const contextOmissionReasonSchema = z.enum([
  "INVALID_PATH",
  "OUTSIDE_WORKSPACE",
  "SYMLINK",
  "DEPENDENCY_OR_GENERATED",
  "SECRET_PATH",
  "MISSING",
  "UNREADABLE",
  "BINARY",
  "SECRET_DETECTED",
  "FILE_TOO_LARGE",
  "FILE_LIMIT",
  "TOTAL_BYTES_LIMIT",
]);
export type ContextOmissionReason = z.infer<typeof contextOmissionReasonSchema>;

export const contextManifestSourceSchema = z.object({
  path: z.string().min(1).max(4096),
  role: contextSourceRoleSchema,
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ContextManifestSource = z.infer<typeof contextManifestSourceSchema>;

export const contextManifestOmissionSchema = z.object({
  path: z.string().min(1).max(4096),
  role: contextSourceRoleSchema,
  reason: contextOmissionReasonSchema,
});
export type ContextManifestOmission = z.infer<typeof contextManifestOmissionSchema>;

export const contextManifestSchema = z.object({
  schemaVersion: z.literal(1),
  baseRevision: z.string().regex(/^[0-9a-f]{7,64}$/i),
  sources: z.array(contextManifestSourceSchema).max(500),
  omissions: z.array(contextManifestOmissionSchema).max(500),
  totalBytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
  manifestHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ContextManifest = z.infer<typeof contextManifestSchema>;

export const contextBuildResultSchema = z.object({
  manifest: contextManifestSchema,
  content: z.string().max(12 * 1024 * 1024),
});
export type ContextBuildResult = z.infer<typeof contextBuildResultSchema>;

export const runtimeGuardPolicySchema = z.object({
  schemaVersion: z.literal(1),
  maxAttempts: z.number().int().min(1).max(10),
  maxElapsedMs: z
    .number()
    .int()
    .min(100)
    .max(24 * 60 * 60 * 1000),
  maxProviderSwitches: z.number().int().min(0).max(10),
  repeatedFailureLimit: z.number().int().min(2).max(5),
  subscriptionOnly: z.literal(true),
  monthlyApiBudget: z.literal(0),
  apiFallbackEnabled: z.literal(false),
  paidExtrasAllowed: z.literal(false),
});
export type RuntimeGuardPolicy = z.infer<typeof runtimeGuardPolicySchema>;

export const runtimeGuardFailureSchema = z.object({
  fingerprint: z.string().trim().min(1).max(200),
  consecutiveCount: z.number().int().positive(),
});
export type RuntimeGuardFailure = z.infer<typeof runtimeGuardFailureSchema>;

export const runtimeGuardStateSchema = z.object({
  schemaVersion: z.literal(1),
  startedAt: z.iso.datetime(),
  attempts: z.number().int().nonnegative(),
  providerSwitches: z.number().int().nonnegative(),
  lastProvider: z.string().trim().min(1).max(120).nullable(),
  lastFailure: runtimeGuardFailureSchema.nullable(),
});
export type RuntimeGuardState = z.infer<typeof runtimeGuardStateSchema>;

export const runtimeGuardPauseReasonSchema = z.enum([
  "ATTEMPT_LIMIT",
  "ELAPSED_TIME_LIMIT",
  "PROVIDER_SWITCH_LIMIT",
  "REPEATED_FAILURE",
]);
export type RuntimeGuardPauseReason = z.infer<typeof runtimeGuardPauseReasonSchema>;

export const runtimeGuardDecisionSchema = z.object({
  action: z.enum(["ALLOW", "PAUSE"]),
  reason: runtimeGuardPauseReasonSchema.nullable(),
  state: runtimeGuardStateSchema,
});
export type RuntimeGuardDecision = z.infer<typeof runtimeGuardDecisionSchema>;

export const workspaceCreateRequestSchema = z.object({
  executionId: z.uuid(),
  repositoryPath: z.string().trim().min(1).max(4096),
  revision: z.string().trim().min(7).max(200),
});
export type WorkspaceCreateRequest = z.infer<typeof workspaceCreateRequestSchema>;

export const workspaceCreateResultSchema = z.object({
  executionId: z.uuid(),
  workspacePath: z.string().min(1).max(4096),
  revision: z.string().regex(/^[0-9a-f]{40}$/),
  detached: z.literal(true),
});
export type WorkspaceCreateResult = z.infer<typeof workspaceCreateResultSchema>;

export const sandboxLimitsSchema = z.object({
  timeoutMs: z.number().int().min(100).max(1_800_000),
  maxLogBytes: z
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024),
  memoryBytes: z
    .number()
    .int()
    .min(64 * 1024 * 1024)
    .max(8 * 1024 * 1024 * 1024),
  cpuQuotaPercent: z.number().int().min(10).max(400),
  maxProcesses: z.number().int().min(16).max(1024),
  maxOpenFiles: z.number().int().min(64).max(65_536),
  maxFileBytes: z
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024 * 1024),
});
export type SandboxLimits = z.infer<typeof sandboxLimitsSchema>;

export const sandboxCommandRequestSchema = z.object({
  schemaVersion: z.literal(1),
  executionId: z.uuid(),
  workspacePath: z.string().trim().min(1).max(4096),
  command: z.string().trim().min(1).max(4096),
  args: z.array(z.string().max(16_384)).max(200),
  environment: z.record(z.string().regex(/^[A-Z_][A-Z0-9_]*$/), z.string().max(16_384)).default({}),
  limits: sandboxLimitsSchema,
});
export type SandboxCommandRequest = z.infer<typeof sandboxCommandRequestSchema>;

export const sandboxCommandResultSchema = z.object({
  schemaVersion: z.literal(1),
  executionId: z.uuid(),
  unitName: z.string().min(1).max(200),
  status: z.enum(["COMPLETED", "FAILED", "TIMED_OUT", "LOG_LIMIT"]),
  exitCode: z.number().int().nullable(),
  stdout: z.string().max(10 * 1024 * 1024),
  stderr: z.string().max(10 * 1024 * 1024),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  stoppedConfirmed: z.boolean(),
});
export type SandboxCommandResult = z.infer<typeof sandboxCommandResultSchema>;

export const snapshotLimitsSchema = z.object({
  maxUntrackedFiles: z.number().int().min(1).max(10_000),
  maxArtifactBytes: z
    .number()
    .int()
    .min(1024)
    .max(1024 * 1024 * 1024),
});
export type SnapshotLimits = z.infer<typeof snapshotLimitsSchema>;

export const snapshotCaptureRequestSchema = z.object({
  schemaVersion: z.literal(1),
  workspacePath: z.string().trim().min(1).max(4096),
  limits: snapshotLimitsSchema,
});
export type SnapshotCaptureRequest = z.infer<typeof snapshotCaptureRequestSchema>;

export const snapshotUntrackedEntrySchema = z.object({
  path: z.string().min(1).max(4096),
  sizeBytes: z.number().int().nonnegative(),
  mode: z.number().int().min(0).max(0o777),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type SnapshotUntrackedEntry = z.infer<typeof snapshotUntrackedEntrySchema>;

export const workspaceSnapshotManifestSchema = z.object({
  schemaVersion: z.literal(1),
  snapshotId: z.uuid(),
  baseRevision: z.string().regex(/^[0-9a-f]{40}$/),
  headRevision: z.string().regex(/^[0-9a-f]{40}$/),
  patchBytes: z.number().int().nonnegative(),
  patchSha256: z.string().regex(/^[0-9a-f]{64}$/),
  untracked: z.array(snapshotUntrackedEntrySchema).max(10_000),
  totalArtifactBytes: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  manifestHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type WorkspaceSnapshotManifest = z.infer<typeof workspaceSnapshotManifestSchema>;

export const workspaceSnapshotSchema = z.object({
  artifactPath: z.string().min(1).max(4096),
  manifest: workspaceSnapshotManifestSchema,
});
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;

export const snapshotRestoreResultSchema = z.object({
  snapshotId: z.uuid(),
  workspacePath: z.string().min(1).max(4096),
  baseRevision: z.string().regex(/^[0-9a-f]{40}$/),
  patchApplied: z.boolean(),
  untrackedFilesRestored: z.number().int().nonnegative(),
});
export type SnapshotRestoreResult = z.infer<typeof snapshotRestoreResultSchema>;

export const orchestrationJobSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.uuid(),
  ticketId: z.uuid(),
  projectId: z.uuid(),
  ticketVersion: z.number().int().positive(),
});
export type OrchestrationJob = z.infer<typeof orchestrationJobSchema>;

export const orchestrationClaimRequestSchema = orchestrationJobSchema.extend({
  workerId: z.uuid(),
  leaseDurationMs: z.number().int().min(15_000).max(300_000),
});
export type OrchestrationClaimRequest = z.infer<typeof orchestrationClaimRequestSchema>;

export const orchestrationClaimSchema = z.object({
  runId: z.uuid(),
  attemptId: z.uuid(),
  workerId: z.uuid(),
  fencingToken: z.number().int().positive(),
  leaseExpiresAt: z.iso.datetime(),
  replayed: z.boolean(),
});
export type OrchestrationClaim = z.infer<typeof orchestrationClaimSchema>;

export const orchestrationLeaseRequestSchema = z.object({
  workerId: z.uuid(),
  fencingToken: z.number().int().positive(),
  leaseDurationMs: z.number().int().min(15_000).max(300_000),
});
export type OrchestrationLeaseRequest = z.infer<typeof orchestrationLeaseRequestSchema>;

export const checkpointReasonSchema = z.enum([
  "PROGRESS",
  "PAUSED",
  "CANCELLED",
  "FAILED",
  "COMPLETED",
]);
export const orchestrationCheckpointRequestSchema = z.object({
  workerId: z.uuid(),
  fencingToken: z.number().int().positive(),
  baseRevision: z.string().regex(/^[0-9a-f]{40}$/),
  codeRevision: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable(),
  snapshotId: z.uuid().nullable(),
  patchHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  reason: checkpointReasonSchema,
  stoppedConfirmed: z.boolean(),
});
export type OrchestrationCheckpointRequest = z.infer<typeof orchestrationCheckpointRequestSchema>;

export const orchestrationCompleteRequestSchema = z.object({
  workerId: z.uuid(),
  fencingToken: z.number().int().positive(),
  outcome: z.enum(["VALIDATING", "PAUSED_LIMIT", "FAILED", "CANCELLED"]),
});
export type OrchestrationCompleteRequest = z.infer<typeof orchestrationCompleteRequestSchema>;

export const orchestrationStateSchema = z.object({
  runId: z.uuid(),
  attemptId: z.uuid(),
  status: z.enum(["RUNNING", "VALIDATING", "PAUSED_LIMIT", "FAILED", "CANCELLED"]),
  stoppedConfirmed: z.boolean(),
});
export type OrchestrationState = z.infer<typeof orchestrationStateSchema>;
