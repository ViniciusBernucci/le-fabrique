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
  "PAUSED",
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

export const gitCommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/);
export type GitCommitSha = z.infer<typeof gitCommitShaSchema>;

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

export const projectRelativePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (path) =>
      path !== "." &&
      !path.startsWith("/") &&
      !path.endsWith("/") &&
      !path.includes("\\") &&
      !path.includes("//") &&
      !path.split("/").some((segment) => segment === "." || segment === ".."),
    "Path must be a normalized repository-relative path",
  );

export const projectCheckSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    command: z.string().trim().min(1).max(4096),
    args: z.array(z.string().max(16_384)).max(200),
  })
  .strict();
export type ProjectCheck = z.infer<typeof projectCheckSchema>;

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

const projectExecutionContextSourceSchema = z
  .object({
    path: projectRelativePathSchema,
    role: contextSourceRoleSchema,
  })
  .strict();

export const projectDocumentationPolicySchema = z
  .object({
    requiredFiles: z
      .array(
        projectRelativePathSchema.refine(
          (file) => file.endsWith(".md") && isWritableProjectPath(file),
        ),
      )
      .min(1)
      .max(30),
    reportPath: projectRelativePathSchema.refine(
      (file) => file.endsWith(".md") && isWritableProjectPath(file),
    ),
    requiredSections: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(120)
          .regex(/^[^\r\n#]+$/),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (policy) => new Set(policy.requiredFiles).size === policy.requiredFiles.length,
    "Documentation paths must be unique",
  )
  .refine(
    (policy) => policy.requiredFiles.includes(policy.reportPath),
    "Report must be a required document",
  )
  .refine(
    (policy) => new Set(policy.requiredSections).size === policy.requiredSections.length,
    "Documentation sections must be unique",
  );
export type ProjectDocumentationPolicy = z.infer<typeof projectDocumentationPolicySchema>;

export const projectExecutionProfileSchema = z
  .object({
    contextSources: z.array(projectExecutionContextSourceSchema).min(1).max(100),
    approvedChecks: z.array(projectCheckSchema).min(1).max(20),
    documentation: projectDocumentationPolicySchema.optional(),
  })
  .strict()
  .superRefine((profile, context) => {
    if (
      new Set(profile.contextSources.map((source) => source.path)).size !==
      profile.contextSources.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["contextSources"],
        message: "Execution context paths must be unique",
      });
    }
    if (
      new Set(profile.approvedChecks.map((check) => check.name)).size !==
      profile.approvedChecks.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvedChecks"],
        message: "Approved check names must be unique",
      });
    }
  });
export type ProjectExecutionProfile = z.infer<typeof projectExecutionProfileSchema>;

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function isWritableProjectPath(path: string): boolean {
  return !path.split("/").some((segment) => segment === ".git" || segment === ".codex");
}

export const projectWritablePathsSchema = z
  .array(projectRelativePathSchema.refine(isWritableProjectPath))
  .max(100)
  .default([])
  .refine((paths) => new Set(paths).size === paths.length, "Writable paths must be unique")
  .refine(
    (paths) =>
      paths.every((path, index) =>
        paths.slice(index + 1).every((other) => !pathsOverlap(path, other)),
      ),
    "Writable paths must not overlap",
  );

export const projectDefinitionInputSchema = z
  .object({
    summary: z.string().trim().min(1).max(4000),
    externalStack: z.string().trim().min(1).max(2000),
    instructions: z.string().trim().min(1).max(8000),
    allowedPaths: z.array(projectRelativePathSchema.refine(isWritableProjectPath)).min(1).max(100),
    forbiddenPaths: z.array(projectRelativePathSchema).max(100),
    checks: z.array(projectCheckSchema).min(1).max(20),
    executionProfile: projectExecutionProfileSchema.nullable().default(null),
  })
  .strict()
  .superRefine((definition, context) => {
    for (const [key, paths] of [
      ["allowedPaths", definition.allowedPaths],
      ["forbiddenPaths", definition.forbiddenPaths],
    ] as const) {
      if (new Set(paths).size !== paths.length) {
        context.addIssue({ code: "custom", path: [key], message: "Paths must be unique" });
      }
    }
    if (
      definition.allowedPaths.some((allowed) =>
        definition.forbiddenPaths.some((forbidden) => pathsOverlap(allowed, forbidden)),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["forbiddenPaths"],
        message: "Allowed and forbidden path scopes must not overlap",
      });
    }
    const checkNames = definition.checks.map((check) => check.name);
    if (new Set(checkNames).size !== checkNames.length) {
      context.addIssue({ code: "custom", path: ["checks"], message: "Check names must be unique" });
    }
    if (!definition.executionProfile) return;

    for (const [index, source] of definition.executionProfile.contextSources.entries()) {
      const allowed = definition.allowedPaths.some(
        (path) => source.path === path || source.path.startsWith(`${path}/`),
      );
      const forbidden = definition.forbiddenPaths.some((path) => pathsOverlap(source.path, path));
      if (!allowed || forbidden) {
        context.addIssue({
          code: "custom",
          path: ["executionProfile", "contextSources", index, "path"],
          message: "Execution context must be within allowed paths and outside forbidden paths",
        });
      }
    }

    for (const [index, file] of (
      definition.executionProfile.documentation?.requiredFiles ?? []
    ).entries()) {
      if (
        !definition.allowedPaths.some((root) => file === root || file.startsWith(`${root}/`)) ||
        definition.forbiddenPaths.some((root) => pathsOverlap(file, root))
      ) {
        context.addIssue({
          code: "custom",
          path: ["executionProfile", "documentation", "requiredFiles", index],
          message: "Required documentation must be writable within allowed paths",
        });
      }
    }

    const projectChecks = new Map(definition.checks.map((check) => [check.name, check]));
    for (const [index, approved] of definition.executionProfile.approvedChecks.entries()) {
      const configured = projectChecks.get(approved.name);
      if (
        !configured ||
        configured.command !== approved.command ||
        JSON.stringify(configured.args) !== JSON.stringify(approved.args)
      ) {
        context.addIssue({
          code: "custom",
          path: ["executionProfile", "approvedChecks", index],
          message: "Approved checks must exactly match configured check commands and arguments",
        });
      }
    }
  });
export type ProjectDefinitionInput = z.infer<typeof projectDefinitionInputSchema>;

export const projectDefinitionSchema = projectDefinitionInputSchema.extend({
  projectId: z.uuid(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProjectDefinition = z.infer<typeof projectDefinitionSchema>;

export const projectDefinitionStateSchema = z.object({
  definition: projectDefinitionSchema.nullable(),
});
export type ProjectDefinitionState = z.infer<typeof projectDefinitionStateSchema>;

export const putProjectDefinitionSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    definition: projectDefinitionInputSchema,
  })
  .strict();
export type PutProjectDefinition = z.infer<typeof putProjectDefinitionSchema>;

export const updateProjectBaseRevisionSchema = z.object({
  expectedBaseRef: z.string().trim().min(1).max(200),
  baseRevision: gitCommitShaSchema,
});
export type UpdateProjectBaseRevision = z.infer<typeof updateProjectBaseRevisionSchema>;

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

export const runtimeProviderSchema = z.enum(["codex", "claude"]);
export type RuntimeProvider = z.infer<typeof runtimeProviderSchema>;

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
  writablePaths: projectWritablePathsSchema,
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
  provider: runtimeProviderSchema,
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
  provider: runtimeProviderSchema,
  state: providerStateSchema,
  authMode: z.enum(["chatgpt", "claude-subscription"]),
  observedAt: z.iso.datetime(),
  cliVersion: z.string().min(1).max(120).nullable(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const providerUsageObservationSchema = z.object({
  provider: runtimeProviderSchema,
  state: z.literal("UNKNOWN"),
  value: z.null(),
  unit: z.null(),
  resetAt: z.null(),
  observedAt: z.iso.datetime(),
  source: z.literal("client-not-exposed"),
});
export type ProviderUsageObservation = z.infer<typeof providerUsageObservationSchema>;

export const settingsProviderSchema = z.enum(["CODEX", "CLAUDE", "ANTIGRAVITY"]);
export type SettingsProvider = z.infer<typeof settingsProviderSchema>;

export const settingsProviderStateSchema = z.enum([
  "UNCONFIGURED",
  "AUTH_REQUIRED",
  "AVAILABLE",
  "BUSY",
  "RATE_LIMITED",
  "COOLDOWN",
  "ERROR",
  "DISABLED",
]);
export type SettingsProviderState = z.infer<typeof settingsProviderStateSchema>;

export const providerInstallationSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    provider: settingsProviderSchema,
    label: z.string().trim().min(1).max(80),
    executable: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .regex(/^\/?[a-zA-Z0-9._/-]+$/),
    enabled: z.boolean(),
    state: settingsProviderStateSchema,
    authMode: z.literal("SUBSCRIPTION_CLI"),
    models: z.array(z.string().trim().min(1).max(120)).max(50),
    defaultModel: z.string().trim().min(1).max(120).nullable(),
  })
  .strict()
  .superRefine((installation, context) => {
    if (new Set(installation.models).size !== installation.models.length) {
      context.addIssue({
        code: "custom",
        message: "Installation models must be unique",
        path: ["models"],
      });
    }
    if (
      installation.defaultModel !== null &&
      !installation.models.includes(installation.defaultModel)
    ) {
      context.addIssue({
        code: "custom",
        message: "Default model must belong to the installation model catalog",
        path: ["defaultModel"],
      });
    }
  });
export type ProviderInstallation = z.infer<typeof providerInstallationSchema>;

export const employeeRoleSchema = z.enum([
  "PLANNER",
  "DEVELOPER",
  "REVIEWER",
  "QA",
  "DOCUMENTATION",
  "SECURITY",
]);
export type EmployeeRole = z.infer<typeof employeeRoleSchema>;

export const agentAssignmentSchema = z
  .object({
    role: employeeRoleSchema,
    enabled: z.boolean(),
    installationId: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
      .nullable(),
    model: z.string().trim().min(1).max(120).nullable(),
    permissionMode: runtimePermissionModeSchema,
    timeoutMinutes: z.number().int().min(1).max(30),
    maxAttempts: z.number().int().min(1).max(2),
    alternatives: z
      .array(
        z
          .object({
            installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
            model: z.string().trim().min(1).max(120),
          })
          .strict(),
      )
      .max(2)
      .optional(),
  })
  .strict();
export type AgentAssignment = z.infer<typeof agentAssignmentSchema>;

export const githubSettingsSchema = z
  .object({
    authMode: z.literal("GH_CLI"),
    state: z.enum(["DISCONNECTED", "AUTH_REQUIRED", "CONNECTED", "ERROR", "DISABLED"]),
    host: z
      .string()
      .trim()
      .min(1)
      .max(253)
      .regex(/^[a-zA-Z0-9.-]+$/),
    owner: z.string().trim().min(1).max(100).nullable(),
    repository: z.string().trim().min(1).max(100).nullable(),
    baseBranch: z.string().trim().min(1).max(200),
    pullRequestCreationEnabled: z.boolean(),
    mergeEnabled: z.literal(false),
  })
  .strict()
  .superRefine((github, context) => {
    if ((github.owner === null) !== (github.repository === null)) {
      context.addIssue({
        code: "custom",
        message: "GitHub owner and repository must be configured together",
        path: ["repository"],
      });
    }
  });
export type GithubSettings = z.infer<typeof githubSettingsSchema>;

export const financialSafetySettingsSchema = z
  .object({
    apiEnabled: z.literal(false),
    extraUsageEnabled: z.literal(false),
    paidCreditsEnabled: z.literal(false),
    autoRechargeEnabled: z.literal(false),
    paidFallbackEnabled: z.literal(false),
  })
  .strict();

const employeeRoles = employeeRoleSchema.options;

export const factoryConfigurationSchema = z
  .object({
    installations: z.array(providerInstallationSchema).max(20),
    assignments: z.array(agentAssignmentSchema).length(employeeRoles.length),
    github: githubSettingsSchema,
    financialSafety: financialSafetySettingsSchema,
  })
  .strict()
  .superRefine((configuration, context) => {
    const installations = new Map<string, ProviderInstallation>();
    for (const [index, installation] of configuration.installations.entries()) {
      if (installations.has(installation.id)) {
        context.addIssue({
          code: "custom",
          message: "Installation ids must be unique",
          path: ["installations", index, "id"],
        });
      }
      installations.set(installation.id, installation);
    }

    const roles = new Set<EmployeeRole>();
    for (const [index, assignment] of configuration.assignments.entries()) {
      if (roles.has(assignment.role)) {
        context.addIssue({
          code: "custom",
          message: "Employee roles must be unique",
          path: ["assignments", index, "role"],
        });
      }
      roles.add(assignment.role);
      const targets = new Set(assignment.installationId ? [assignment.installationId] : []);
      for (const alternative of assignment.alternatives ?? []) {
        const target = installations.get(alternative.installationId);
        if (
          !assignment.installationId ||
          !assignment.model ||
          targets.has(alternative.installationId) ||
          !target?.enabled ||
          !target.models.includes(alternative.model)
        )
          context.addIssue({
            code: "custom",
            message:
              "Handoff alternatives require distinct enabled installations and allowed models",
            path: ["assignments", index, "alternatives"],
          });
        targets.add(alternative.installationId);
      }
      if ((assignment.installationId === null) !== (assignment.model === null)) {
        context.addIssue({
          code: "custom",
          message: "Installation and model must be selected together",
          path: ["assignments", index],
        });
        continue;
      }
      if (assignment.installationId === null || assignment.model === null) continue;
      const installation = installations.get(assignment.installationId);
      if (!installation?.enabled || !installation.models.includes(assignment.model)) {
        context.addIssue({
          code: "custom",
          message: "Assignment requires an enabled installation and one of its allowed models",
          path: ["assignments", index],
        });
      }
    }
    for (const role of employeeRoles) {
      if (!roles.has(role)) {
        context.addIssue({ code: "custom", message: `Missing employee role: ${role}` });
      }
    }
  });
export type FactoryConfiguration = z.infer<typeof factoryConfigurationSchema>;

export const factorySettingsSchema = z
  .object({
    version: z.number().int().positive(),
    configuration: factoryConfigurationSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type FactorySettings = z.infer<typeof factorySettingsSchema>;

export const workerConfigurationSnapshotSchema = z
  .object({
    version: z.number().int().nonnegative(),
    observedAt: z.iso.datetime(),
    configuration: factoryConfigurationSchema,
  })
  .strict();
export type WorkerConfigurationSnapshot = z.infer<typeof workerConfigurationSnapshotSchema>;

export const updateFactorySettingsSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    configuration: factoryConfigurationSchema,
  })
  .strict();
export type UpdateFactorySettings = z.infer<typeof updateFactorySettingsSchema>;

export const providerVerificationStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);
export type ProviderVerificationStatus = z.infer<typeof providerVerificationStatusSchema>;

export const providerVerificationSchema = z.object({
  id: z.uuid(),
  installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  provider: settingsProviderSchema,
  status: providerVerificationStatusSchema,
  workerId: z.uuid().nullable(),
  providerState: settingsProviderStateSchema.nullable(),
  cliVersion: z.string().trim().min(1).max(120).nullable(),
  observedModels: z.array(z.string().trim().min(1).max(120)).max(50),
  message: z.string().trim().min(1).max(240).nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
});
export type ProviderVerification = z.infer<typeof providerVerificationSchema>;
export const providerVerificationListSchema = z.array(providerVerificationSchema);

export const providerVerificationJobSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.uuid(),
  verificationId: z.uuid(),
  installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  provider: settingsProviderSchema,
});
export type ProviderVerificationJob = z.infer<typeof providerVerificationJobSchema>;

export const startProviderVerificationSchema = z.object({ workerId: z.uuid() }).strict();
export const completeProviderVerificationSchema = z
  .object({
    workerId: z.uuid(),
    status: z.enum(["COMPLETED", "FAILED"]),
    providerState: settingsProviderStateSchema,
    cliVersion: z.string().trim().min(1).max(120).nullable(),
    observedModels: z.array(z.string().trim().min(1).max(120)).max(50),
    message: z.string().trim().min(1).max(240),
  })
  .strict();
export type CompleteProviderVerification = z.infer<typeof completeProviderVerificationSchema>;

export const githubVerificationStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);
export type GithubVerificationStatus = z.infer<typeof githubVerificationStatusSchema>;

export const githubVerificationSchema = z
  .object({
    id: z.uuid(),
    host: githubSettingsSchema.shape.host,
    status: githubVerificationStatusSchema,
    workerId: z.uuid().nullable(),
    githubState: githubSettingsSchema.shape.state.nullable(),
    cliVersion: z.string().trim().min(1).max(120).nullable(),
    message: z.string().trim().min(1).max(240).nullable(),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type GithubVerification = z.infer<typeof githubVerificationSchema>;
export const githubVerificationListSchema = z.array(githubVerificationSchema);

export const githubVerificationJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.uuid(),
    verificationId: z.uuid(),
    host: githubSettingsSchema.shape.host,
  })
  .strict();
export type GithubVerificationJob = z.infer<typeof githubVerificationJobSchema>;

export const startGithubVerificationSchema = z.object({ workerId: z.uuid() }).strict();
export const completeGithubVerificationSchema = z
  .object({
    workerId: z.uuid(),
    status: z.enum(["COMPLETED", "FAILED"]),
    githubState: githubSettingsSchema.shape.state,
    cliVersion: z.string().trim().min(1).max(120).nullable(),
    message: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === "FAILED" && result.githubState !== "ERROR") {
      context.addIssue({
        code: "custom",
        message: "Failed GitHub verification must report ERROR",
        path: ["githubState"],
      });
    }
    if (
      result.status === "COMPLETED" &&
      !["CONNECTED", "AUTH_REQUIRED"].includes(result.githubState)
    ) {
      context.addIssue({
        code: "custom",
        message: "Completed GitHub verification must report connection evidence",
        path: ["githubState"],
      });
    }
  });
export type CompleteGithubVerification = z.infer<typeof completeGithubVerificationSchema>;

export const githubOnboardingStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "AWAITING_USER",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
]);
export type GithubOnboardingStatus = z.infer<typeof githubOnboardingStatusSchema>;

export const githubCredentialStorageSchema = z.enum(["SECURE_STORE", "PLAINTEXT_FILE", "UNKNOWN"]);
export type GithubCredentialStorage = z.infer<typeof githubCredentialStorageSchema>;

export const githubOnboardingSessionSchema = z
  .object({
    id: z.uuid(),
    host: githubSettingsSchema.shape.host,
    status: githubOnboardingStatusSchema,
    workerId: z.uuid().nullable(),
    githubState: githubSettingsSchema.shape.state.nullable(),
    credentialStorage: githubCredentialStorageSchema.nullable(),
    message: z.string().trim().min(1).max(240).nullable(),
    expiresAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type GithubOnboardingSession = z.infer<typeof githubOnboardingSessionSchema>;
export const githubOnboardingSessionListSchema = z.array(githubOnboardingSessionSchema);

export const githubOnboardingJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.uuid(),
    sessionId: z.uuid(),
    host: githubSettingsSchema.shape.host,
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type GithubOnboardingJob = z.infer<typeof githubOnboardingJobSchema>;

export const githubOnboardingChallengeSchema = z
  .object({
    verificationUri: z
      .url()
      .max(500)
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && url.pathname.replace(/\/$/, "") === "/login/device";
      }, "GitHub challenge must use the HTTPS device path"),
    userCode: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{4,12}(?:-[A-Z0-9]{4,12}){0,3}$/),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type GithubOnboardingChallenge = z.infer<typeof githubOnboardingChallengeSchema>;

export const startGithubOnboardingSchema = z.object({ workerId: z.uuid() }).strict();
export const publishGithubOnboardingChallengeSchema = z
  .object({ workerId: z.uuid(), challenge: githubOnboardingChallengeSchema })
  .strict();
export const completeGithubOnboardingSchema = z
  .object({
    workerId: z.uuid(),
    status: z.enum(["COMPLETED", "FAILED", "EXPIRED"]),
    githubState: githubSettingsSchema.shape.state,
    credentialStorage: githubCredentialStorageSchema,
    message: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((result, context) => {
    if (
      result.status === "COMPLETED" &&
      (result.githubState !== "CONNECTED" || result.credentialStorage !== "SECURE_STORE")
    ) {
      context.addIssue({
        code: "custom",
        message: "Completed GitHub onboarding requires secure connected evidence",
      });
    }
    if (result.status === "EXPIRED" && result.githubState !== "AUTH_REQUIRED") {
      context.addIssue({
        code: "custom",
        message: "Expired GitHub onboarding must require authentication",
      });
    }
    if (result.status === "FAILED" && result.githubState === "CONNECTED") {
      context.addIssue({
        code: "custom",
        message: "Failed GitHub onboarding cannot report CONNECTED",
      });
    }
  });
export type CompleteGithubOnboarding = z.infer<typeof completeGithubOnboardingSchema>;

export const githubRepositoryVerificationStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);
export type GithubRepositoryVerificationStatus = z.infer<
  typeof githubRepositoryVerificationStatusSchema
>;

export const githubRepositoryAccessSchema = z.enum(["READABLE", "UNAVAILABLE"]);
export type GithubRepositoryAccess = z.infer<typeof githubRepositoryAccessSchema>;

export const githubRepositoryVerificationSchema = z
  .object({
    id: z.uuid(),
    host: githubSettingsSchema.shape.host,
    owner: z.string().trim().min(1).max(100),
    repository: z.string().trim().min(1).max(100),
    baseBranch: githubSettingsSchema.shape.baseBranch,
    status: githubRepositoryVerificationStatusSchema,
    workerId: z.uuid().nullable(),
    access: githubRepositoryAccessSchema.nullable(),
    observedOwner: z.string().trim().min(1).max(100).nullable(),
    observedRepository: z.string().trim().min(1).max(100).nullable(),
    defaultBranch: z.string().trim().min(1).max(200).nullable(),
    observedBaseBranch: z.string().trim().min(1).max(200).nullable(),
    isPrivate: z.boolean().nullable(),
    isArchived: z.boolean().nullable(),
    message: z.string().trim().min(1).max(240).nullable(),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type GithubRepositoryVerification = z.infer<typeof githubRepositoryVerificationSchema>;
export const githubRepositoryVerificationListSchema = z.array(githubRepositoryVerificationSchema);

export const githubRepositoryVerificationJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.uuid(),
    verificationId: z.uuid(),
    host: githubSettingsSchema.shape.host,
    owner: z.string().trim().min(1).max(100),
    repository: z.string().trim().min(1).max(100),
    baseBranch: githubSettingsSchema.shape.baseBranch,
  })
  .strict();
export type GithubRepositoryVerificationJob = z.infer<typeof githubRepositoryVerificationJobSchema>;

export const startGithubRepositoryVerificationSchema = z.object({ workerId: z.uuid() }).strict();
export const completeGithubRepositoryVerificationSchema = z
  .object({
    workerId: z.uuid(),
    status: z.enum(["COMPLETED", "FAILED"]),
    access: githubRepositoryAccessSchema,
    observedOwner: z.string().trim().min(1).max(100).nullable(),
    observedRepository: z.string().trim().min(1).max(100).nullable(),
    defaultBranch: z.string().trim().min(1).max(200).nullable(),
    observedBaseBranch: z.string().trim().min(1).max(200).nullable(),
    isPrivate: z.boolean().nullable(),
    isArchived: z.boolean().nullable(),
    message: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((result, context) => {
    const observations = [
      result.observedOwner,
      result.observedRepository,
      result.defaultBranch,
      result.observedBaseBranch,
      result.isPrivate,
      result.isArchived,
    ];
    if (
      result.status === "COMPLETED" &&
      (result.access !== "READABLE" || observations.some((value) => value === null))
    ) {
      context.addIssue({
        code: "custom",
        message: "Completed repository verification requires complete readable evidence",
      });
    }
    if (
      result.status === "FAILED" &&
      (result.access !== "UNAVAILABLE" || observations.some((value) => value !== null))
    ) {
      context.addIssue({
        code: "custom",
        message: "Failed repository verification cannot expose partial observations",
      });
    }
  });
export type CompleteGithubRepositoryVerification = z.infer<
  typeof completeGithubRepositoryVerificationSchema
>;

export const githubBranchNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._/-]+$/)
  .refine(
    (value) =>
      !value.startsWith("-") &&
      !value.startsWith("/") &&
      !value.startsWith(".") &&
      !value.endsWith("/") &&
      !value.endsWith(".") &&
      !value.includes("..") &&
      !value.includes("//"),
    "Invalid GitHub branch name",
  );
export const githubOwnerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/);
export const githubRepositoryNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_.-]+$/)
  .refine((value) => value !== "." && value !== "..", "Invalid GitHub repository name");

export const githubPullRequestStatusSchema = z.enum([
  "PREPARED",
  "APPROVED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type GithubPullRequestStatus = z.infer<typeof githubPullRequestStatusSchema>;
export const githubPullRequestDispositionSchema = z.enum(["CREATED", "EXISTING"]);
export type GithubPullRequestDisposition = z.infer<typeof githubPullRequestDispositionSchema>;

export const prepareGithubPullRequestSchema = z
  .object({
    headBranch: githubBranchNameSchema,
    title: z.string().trim().min(1).max(200),
    body: z.string().max(10 * 1024),
    draft: z.boolean(),
  })
  .strict();
export type PrepareGithubPullRequest = z.infer<typeof prepareGithubPullRequestSchema>;

export const githubPullRequestSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    host: githubSettingsSchema.shape.host,
    owner: githubOwnerNameSchema,
    repository: githubRepositoryNameSchema,
    baseBranch: githubBranchNameSchema,
    headBranch: githubBranchNameSchema,
    title: z.string().trim().min(1).max(200),
    body: z.string().max(10 * 1024),
    draft: z.boolean(),
    approvalDigest: z.string().regex(/^[a-f0-9]{64}$/),
    status: githubPullRequestStatusSchema,
    workerId: z.uuid().nullable(),
    disposition: githubPullRequestDispositionSchema.nullable(),
    pullRequestNumber: z.number().int().positive().nullable(),
    pullRequestUrl: z.url().max(500).nullable(),
    message: z.string().trim().min(1).max(240).nullable(),
    createdAt: z.iso.datetime(),
    approvedAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    cancelledAt: z.iso.datetime().nullable(),
  })
  .strict();
export type GithubPullRequest = z.infer<typeof githubPullRequestSchema>;
export const githubPullRequestListSchema = z.array(githubPullRequestSchema);

export const approveGithubPullRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    approvalDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type ApproveGithubPullRequest = z.infer<typeof approveGithubPullRequestSchema>;
export const cancelGithubPullRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export const githubPullRequestJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.uuid(),
    requestId: z.uuid(),
    approvalDigest: z.string().regex(/^[a-f0-9]{64}$/),
    host: githubSettingsSchema.shape.host,
    owner: githubOwnerNameSchema,
    repository: githubRepositoryNameSchema,
    baseBranch: githubBranchNameSchema,
    headBranch: githubBranchNameSchema,
    title: z.string().trim().min(1).max(200),
    body: z.string().max(10 * 1024),
    draft: z.boolean(),
  })
  .strict();
export type GithubPullRequestJob = z.infer<typeof githubPullRequestJobSchema>;

export const startGithubPullRequestSchema = z.object({ workerId: z.uuid() }).strict();
export const completeGithubPullRequestSchema = z
  .object({
    workerId: z.uuid(),
    status: z.enum(["COMPLETED", "FAILED"]),
    disposition: githubPullRequestDispositionSchema.nullable(),
    pullRequestNumber: z.number().int().positive().nullable(),
    pullRequestUrl: z.url().max(500).nullable(),
    message: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((result, context) => {
    const hasResult =
      result.disposition !== null &&
      result.pullRequestNumber !== null &&
      result.pullRequestUrl !== null;
    if (result.status === "COMPLETED" && !hasResult) {
      context.addIssue({ code: "custom", message: "Completed pull request requires exact result" });
    }
    if (result.status === "FAILED" && hasResult) {
      context.addIssue({ code: "custom", message: "Failed pull request cannot expose a result" });
    }
    if (
      result.status === "FAILED" &&
      [result.disposition, result.pullRequestNumber, result.pullRequestUrl].some(
        (value) => value !== null,
      )
    ) {
      context.addIssue({ code: "custom", message: "Failed pull request cannot be partial" });
    }
  });
export type CompleteGithubPullRequest = z.infer<typeof completeGithubPullRequestSchema>;

export const providerOnboardingStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "AWAITING_USER",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
]);
export type ProviderOnboardingStatus = z.infer<typeof providerOnboardingStatusSchema>;

export const providerOnboardingSessionSchema = z
  .object({
    id: z.uuid(),
    installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    provider: z.literal("CODEX"),
    status: providerOnboardingStatusSchema,
    workerId: z.uuid().nullable(),
    providerState: settingsProviderStateSchema.nullable(),
    message: z.string().trim().min(1).max(240).nullable(),
    expiresAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type ProviderOnboardingSession = z.infer<typeof providerOnboardingSessionSchema>;
export const providerOnboardingSessionListSchema = z.array(providerOnboardingSessionSchema);

export const providerOnboardingJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.uuid(),
    sessionId: z.uuid(),
    installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    provider: z.literal("CODEX"),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type ProviderOnboardingJob = z.infer<typeof providerOnboardingJobSchema>;

export const providerOnboardingChallengeSchema = z
  .object({
    verificationUri: z
      .url()
      .max(500)
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          (url.hostname === "openai.com" ||
            url.hostname.endsWith(".openai.com") ||
            url.hostname === "chatgpt.com" ||
            url.hostname.endsWith(".chatgpt.com"))
        );
      }, "Challenge URL must use an official HTTPS host"),
    userCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{4,12}(?:-[A-Za-z0-9]{4,12}){0,3}$/),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type ProviderOnboardingChallenge = z.infer<typeof providerOnboardingChallengeSchema>;

export const startProviderOnboardingSchema = z.object({ workerId: z.uuid() }).strict();
export const publishProviderOnboardingChallengeSchema = z
  .object({ workerId: z.uuid(), challenge: providerOnboardingChallengeSchema })
  .strict();
export const completeProviderOnboardingSchema = z
  .object({
    workerId: z.uuid(),
    status: z.enum(["COMPLETED", "FAILED", "EXPIRED"]),
    providerState: settingsProviderStateSchema,
    message: z.string().trim().min(1).max(240),
  })
  .strict();
export type CompleteProviderOnboarding = z.infer<typeof completeProviderOnboardingSchema>;

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
  writablePaths: projectWritablePathsSchema,
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

const artifactRelativePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !path.startsWith("/") &&
      !path.includes("\\") &&
      [...path].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127) &&
      !/^[A-Za-z]:/.test(path) &&
      path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "Unsafe artifact path",
  );
export const ARTIFACT_JSON_MAX_BYTES = 8 * 1024 * 1024;
export const ARTIFACT_RAW_MAX_BYTES = 6 * 1024 * 1024;
export const ARTIFACT_HTTP_MAX_BYTES = ARTIFACT_JSON_MAX_BYTES + 4096;
const artifactBase64Schema = z
  .string()
  .max(ARTIFACT_JSON_MAX_BYTES)
  .refine((value) => {
    if (
      value.length > ARTIFACT_JSON_MAX_BYTES ||
      value.length % 4 !== 0 ||
      /[^A-Za-z0-9+/=]/.test(value)
    )
      return false;
    try {
      return btoa(atob(value)) === value;
    } catch {
      return false;
    }
  }, "Noncanonical artifact base64");
export const executionArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    manifest: workspaceSnapshotManifestSchema
      .extend({
        untracked: z
          .array(snapshotUntrackedEntrySchema.extend({ path: artifactRelativePathSchema }).strict())
          .max(1000),
      })
      .strict(),
    patchBase64: artifactBase64Schema,
    files: z
      .array(
        z.object({ path: artifactRelativePathSchema, dataBase64: artifactBase64Schema }).strict(),
      )
      .max(1000),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.manifest.totalArtifactBytes > ARTIFACT_RAW_MAX_BYTES)
      context.addIssue({
        code: "custom",
        message: "Artifact raw bytes exceed 6 MiB delivery limit",
      });
    if (new TextEncoder().encode(JSON.stringify(artifact)).length > ARTIFACT_JSON_MAX_BYTES)
      context.addIssue({ code: "custom", message: "Artifact JSON exceeds 8 MiB delivery limit" });
  });
export type ExecutionArtifact = z.infer<typeof executionArtifactSchema>;
export const reportExecutionArtifactSchema = z
  .object({
    workerId: z.uuid(),
    fencingToken: z.number().int().positive(),
    artifact: executionArtifactSchema,
  })
  .strict();
export const executionArtifactStateSchema = z
  .object({ artifact: executionArtifactSchema.nullable() })
  .strict();

/** Platform-neutral verifier: decoding/hashing ports keep server imports out of the panel. */
export function verifyExecutionArtifact(
  artifact: ExecutionArtifact,
  decode: (base64: string) => Uint8Array,
  digest: (bytes: Uint8Array) => string,
): void {
  const { manifestHash, ...core } = artifact.manifest;
  if (digest(new TextEncoder().encode(JSON.stringify(core))) !== manifestHash)
    throw new Error("Artifact manifest integrity mismatch");
  const patch = decode(artifact.patchBase64);
  if (
    patch.length !== artifact.manifest.patchBytes ||
    digest(patch) !== artifact.manifest.patchSha256
  )
    throw new Error("Artifact patch integrity mismatch");
  const files = new Map(artifact.files.map((file) => [file.path, file.dataBase64]));
  if (files.size !== artifact.files.length || files.size !== artifact.manifest.untracked.length)
    throw new Error("Artifact file set mismatch");
  let total = patch.length;
  const decoder = new TextDecoder();
  const sensitive =
    /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]+|\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}|\b(?:OPENAI_API_KEY|CODEX_API_KEY|ANTHROPIC_API_KEY|WORKER_API_TOKEN|ADMIN_API_TOKEN)\s*[=:]\s*["']?[^\s"']+/i;
  if (sensitive.test(decoder.decode(patch)))
    throw new Error("Known sensitive artifact content blocked");
  if (
    decoder
      .decode(patch)
      .split("\n")
      .some(
        (line) =>
          /^(?:diff --git |--- |\+\+\+ )/.test(line) &&
          /\/(?:auth\.json|credentials(?:\.json)?|id_rsa|id_ed25519|\.env(?:\.(?!example(?:\s|$))[^\s/]+)?)(?=[\s"/]|$)/i.test(
            line,
          ),
      )
  )
    throw new Error("Sensitive tracked artifact path blocked");
  for (const entry of artifact.manifest.untracked) {
    if (
      /(?:^|\/)(?:auth\.json|credentials(?:\.json)?|id_rsa|id_ed25519|\.env(?:\.(?!example$)[^/]+)?)(?:$|\/)/i.test(
        entry.path,
      )
    )
      throw new Error("Sensitive artifact path blocked");
    const encoded = files.get(entry.path);
    if (encoded === undefined) throw new Error("Artifact file missing");
    const bytes = decode(encoded);
    total += bytes.length;
    if (bytes.length !== entry.sizeBytes || digest(bytes) !== entry.sha256)
      throw new Error("Artifact file integrity mismatch");
    if (sensitive.test(decoder.decode(bytes)))
      throw new Error("Known sensitive artifact content blocked");
  }
  if (total !== artifact.manifest.totalArtifactBytes)
    throw new Error("Artifact total size mismatch");
}

export const snapshotRestoreResultSchema = z.object({
  snapshotId: z.uuid(),
  workspacePath: z.string().min(1).max(4096),
  baseRevision: z.string().regex(/^[0-9a-f]{40}$/),
  patchApplied: z.boolean(),
  untrackedFilesRestored: z.number().int().nonnegative(),
});
export type SnapshotRestoreResult = z.infer<typeof snapshotRestoreResultSchema>;

export const executionSpecificationSchema = z
  .object({
    schemaVersion: z.literal(1),
    project: z
      .object({
        id: z.uuid(),
        name: z.string().trim().min(1).max(120),
        repoUrl: z.url(),
        baseRevision: gitCommitShaSchema,
        definitionVersion: z.number().int().positive(),
        definition: projectDefinitionInputSchema,
      })
      .strict(),
    ticket: z
      .object({
        id: z.uuid(),
        version: z.number().int().positive(),
        title: z.string().trim().min(1).max(160),
        objective: z.string().trim().min(1).max(4000),
        acceptanceCriteria: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
      })
      .strict(),
  })
  .strict();
export type ExecutionSpecification = z.infer<typeof executionSpecificationSchema>;

export const resumeEvidenceSchema = z
  .object({
    attemptId: z.uuid(),
    fencingToken: z.number().int().positive(),
    resultDigest: z.string().regex(/^[a-f0-9]{64}$/),
    artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: workspaceSnapshotManifestSchema
      .omit({ untracked: true })
      .extend({ untrackedFiles: z.number().int().nonnegative() })
      .strict(),
  })
  .strict();
export type ResumeEvidence = z.infer<typeof resumeEvidenceSchema>;

const orchestrationJobFieldsSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.uuid(),
  ticketId: z.uuid(),
  projectId: z.uuid(),
  ticketVersion: z.number().int().positive(),
  baseRevision: gitCommitShaSchema.nullable().default(null),
  projectDefinitionVersion: z.number().int().positive().nullable().default(null),
  executionSpecification: executionSpecificationSchema.nullable().default(null),
  resumeFrom: resumeEvidenceSchema.optional(),
});

function validateExecutionSpecificationConsistency(
  job: z.infer<typeof orchestrationJobFieldsSchema>,
  context: z.RefinementCtx,
): void {
  const specification = job.executionSpecification;
  if (
    job.resumeFrom &&
    (!specification || job.resumeFrom.snapshot.baseRevision !== job.baseRevision)
  ) {
    context.addIssue({
      code: "custom",
      path: ["resumeFrom"],
      message: "Resume requires the original immutable base",
    });
  }
  if (!specification) return;
  const mismatches = [
    [specification.project.id !== job.projectId, "projectId"],
    [specification.ticket.id !== job.ticketId, "ticketId"],
    [specification.ticket.version !== job.ticketVersion, "ticketVersion"],
    [specification.project.baseRevision !== job.baseRevision, "baseRevision"],
    [
      specification.project.definitionVersion !== job.projectDefinitionVersion,
      "projectDefinitionVersion",
    ],
  ] as const;
  for (const [mismatch, field] of mismatches) {
    if (mismatch) {
      context.addIssue({
        code: "custom",
        path: ["executionSpecification", field],
        message: `Execution specification does not match ${field}`,
      });
    }
  }
}

export const orchestrationJobSchema = orchestrationJobFieldsSchema.superRefine(
  validateExecutionSpecificationConsistency,
);
export type OrchestrationJob = z.infer<typeof orchestrationJobSchema>;

export const finalizationRecoveryJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.literal("FINALIZATION_ONLY"),
    eventId: z.uuid(),
    runId: z.uuid(),
    attemptId: z.uuid(),
    workerId: z.uuid(),
    fencingToken: z.number().int().positive(),
    originalJob: orchestrationJobSchema.strict(),
  })
  .strict();
export type FinalizationRecoveryJob = z.infer<typeof finalizationRecoveryJobSchema>;
export const requestRunRecoverySchema = z
  .object({ expectedVersion: z.number().int().positive(), attemptId: z.uuid() })
  .strict();
export type RequestRunRecovery = z.infer<typeof requestRunRecoverySchema>;
export const runRecoveryReceiptSchema = z
  .object({
    runId: z.uuid(),
    attemptId: z.uuid(),
    eventId: z.uuid(),
    status: z.literal("REQUESTED"),
  })
  .strict();

export const orchestrationClaimRequestSchema = orchestrationJobFieldsSchema
  .extend({
    workerId: z.uuid(),
    leaseDurationMs: z.number().int().min(15_000).max(300_000),
  })
  .superRefine(validateExecutionSpecificationConsistency);
export type OrchestrationClaimRequest = z.infer<typeof orchestrationClaimRequestSchema>;

export const orchestrationClaimSchema = z.object({
  runId: z.uuid(),
  attemptId: z.uuid(),
  workerId: z.uuid(),
  fencingToken: z.number().int().positive(),
  leaseExpiresAt: z.iso.datetime(),
  replayed: z.boolean(),
  controlAction: z.enum(["PAUSE", "CANCEL"]).nullable().optional(),
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
  "WAITING_PROVIDER",
  "PAUSED",
  "OPERATOR_PAUSED",
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
  outcome: z.enum([
    "VALIDATING",
    "WAITING_PROVIDER",
    "PAUSED",
    "PAUSED_LIMIT",
    "FAILED",
    "CANCELLED",
  ]),
});
export type OrchestrationCompleteRequest = z.infer<typeof orchestrationCompleteRequestSchema>;

export const orchestrationStateSchema = z.object({
  runId: z.uuid(),
  attemptId: z.uuid(),
  status: z.enum([
    "RUNNING",
    "VALIDATING",
    "WAITING_PROVIDER",
    "PAUSED",
    "PAUSED_LIMIT",
    "FAILED",
    "CANCELLED",
  ]),
  stoppedConfirmed: z.boolean(),
});
export type OrchestrationState = z.infer<typeof orchestrationStateSchema>;

export const orchestrationReconcileRequestSchema = z
  .object({
    workerId: z.uuid(),
    fencingToken: z.number().int().positive(),
  })
  .strict();
export type OrchestrationReconcileRequest = z.infer<typeof orchestrationReconcileRequestSchema>;
export const orchestrationReconcileResultSchema = z
  .object({
    state: orchestrationStateSchema.nullable(),
  })
  .strict();

export const workflowCheckCommandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  command: z.string().trim().min(1).max(4096),
  args: z.array(z.string().max(16_384)).max(200),
  environment: z.record(z.string().regex(/^[A-Z_][A-Z0-9_]*$/), z.string().max(16_384)).default({}),
});
export type WorkflowCheckCommand = z.infer<typeof workflowCheckCommandSchema>;

export const developerWorkflowRequestSchema = z.object({
  schemaVersion: z.literal(1),
  workflowId: z.uuid(),
  repositoryPath: z.string().trim().min(1).max(4096),
  baseRevision: z.string().regex(/^[0-9a-f]{40}$/),
  objective: z.string().trim().min(1).max(4000),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  contextSources: z.array(contextSourceRequestSchema).min(1).max(500),
  contextLimits: contextLimitsSchema,
  checks: z.array(workflowCheckCommandSchema).min(1).max(20),
  writablePaths: projectWritablePathsSchema,
  guardPolicy: runtimeGuardPolicySchema,
  runtimeLimits: runtimeLimitsSchema,
  sandboxLimits: sandboxLimitsSchema,
  snapshotLimits: snapshotLimitsSchema,
  maxCorrectionRounds: z.number().int().min(0).max(2).default(2),
  modelRequested: z.string().trim().min(1).max(120).nullable().default(null),
  documentation: projectDocumentationPolicySchema.optional(),
});
export type DeveloperWorkflowRequest = z.infer<typeof developerWorkflowRequestSchema>;

export const workflowCheckObservationSchema = z.object({
  name: z.string().min(1).max(120),
  phase: z.enum(["BASELINE", "POST_CHANGE"]),
  round: z.number().int().nonnegative(),
  status: sandboxCommandResultSchema.shape.status,
  exitCode: z.number().int().nullable(),
  stoppedConfirmed: z.boolean(),
  preExisting: z.boolean(),
});
export type WorkflowCheckObservation = z.infer<typeof workflowCheckObservationSchema>;

export const workflowReviewSchema = z.object({
  schemaVersion: z.literal(1),
  verdict: z.enum(["APPROVE", "REQUEST_CHANGES"]),
  summary: z.string().trim().min(1).max(4000),
  findings: z.array(z.string().trim().min(1).max(1000)).max(20),
});
export type WorkflowReview = z.infer<typeof workflowReviewSchema>;

export const workflowRuntimeObservationSchema = z
  .object({
    executionId: z.uuid(),
    role: z.enum(["DEVELOPER", "REVIEWER"]),
    installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    provider: runtimeProviderSchema,
    modelRequested: z.string().max(120).transform(redactExecutionReportText).nullable(),
    modelEffective: z.string().max(120).transform(redactExecutionReportText).nullable(),
    configurationVersion: z.number().int().nonnegative(),
    configurationObservedAt: z.iso.datetime(),
    status: runtimeExecutionResultSchema.shape.status,
    errorCode: runtimeExecutionResultSchema.shape.error.unwrap().shape.code.nullable(),
    usage: runtimeUsageSchema.strict().nullable(),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
  })
  .strict();
export type WorkflowRuntimeObservation = z.infer<typeof workflowRuntimeObservationSchema>;

export const workflowHandoffSchema = z
  .object({
    role: z.enum(["DEVELOPER", "REVIEWER"]),
    fromInstallationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    toInstallationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    sourceExecutionId: z.uuid(),
    reason: z.enum(["AUTH_REQUIRED", "RATE_LIMITED", "PROVIDER_BUSY"]),
    snapshotId: z.uuid(),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    (handoff) => handoff.fromInstallationId !== handoff.toInstallationId,
    "Handoff requires another installation",
  );

export const workflowDocumentationEvidenceSchema = z
  .object({
    status: z.enum(["PASS", "FAIL"]),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    files: z
      .array(
        z
          .object({ path: projectRelativePathSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/) })
          .strict(),
      )
      .max(30),
    findings: z
      .array(
        z.enum([
          "MISSING_OR_UNSAFE",
          "UNCHANGED",
          "PLACEHOLDER",
          "INCOMPLETE_SECTIONS",
          "MISSING_REVISION",
          "MISSING_CHECKS",
        ]),
      )
      .max(30),
  })
  .strict();
export type WorkflowDocumentationEvidence = z.infer<typeof workflowDocumentationEvidenceSchema>;

export const developerWorkflowResultSchema = z.object({
  schemaVersion: z.literal(1),
  workflowId: z.uuid(),
  status: z.enum([
    "AWAITING_HUMAN",
    "WAITING_PROVIDER",
    "PAUSED",
    "PAUSED_LIMIT",
    "FAILED",
    "CANCELLED",
  ]),
  reason: z.enum([
    "APPROVED",
    "RUNTIME_GUARD",
    "RUNTIME_ROUTE_UNAVAILABLE",
    "PROVIDER_UNAVAILABLE",
    "DEVELOPER_FAILED",
    "CHECK_UNQUIESCED",
    "CHECK_REGRESSION",
    "REVIEW_REJECTED",
    "REVIEW_INVALID",
    "DOCUMENTATION_INCOMPLETE",
    "INTERRUPTED",
    "OPERATOR_PAUSED",
    "OPERATOR_CANCELLED",
  ]),
  workspace: workspaceCreateResultSchema,
  contextManifest: contextManifestSchema,
  guardState: runtimeGuardStateSchema,
  developerExecutions: z.number().int().nonnegative(),
  reviewerExecutions: z.number().int().nonnegative(),
  corrections: z.number().int().nonnegative().max(2),
  checks: z.array(workflowCheckObservationSchema),
  snapshots: z.array(workspaceSnapshotManifestSchema).max(3),
  review: workflowReviewSchema.nullable(),
  diagnostic: z.string().trim().min(1).max(1000),
  runtimeObservations: z.array(workflowRuntimeObservationSchema).max(10).default([]),
  handoffs: z.array(workflowHandoffSchema).max(2).optional(),
  documentation: workflowDocumentationEvidenceSchema.optional(),
});
export type DeveloperWorkflowResult = z.infer<typeof developerWorkflowResultSchema>;

/** Minimize known credential/path patterns in untrusted model text before publishing it. */
export function redactExecutionReportText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,})/g,
      "[redacted]",
    )
    .replace(
      /\b(?:[A-Z_]*(?:API_KEY|OAUTH_TOKEN)|GH_TOKEN|GITHUB_TOKEN|ADMIN_API_TOKEN|WORKER_API_TOKEN)\s*[:=]\s*["']?[^\s"'<>]+/gi,
      "[credential redacted]",
    )
    .replace(/\/(?:home|root|var|etc|opt|srv|run|tmp)\/[^\s"'<>]+/g, "[host path]");
}
const publicReportText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((value) => redactExecutionReportText(value).slice(0, max));

export const executionResultReportSchema = developerWorkflowResultSchema
  .omit({
    workspace: true,
    contextManifest: true,
    guardState: true,
  })
  .extend({
    diagnostic: publicReportText(1000),
    checks: z
      .array(workflowCheckObservationSchema.extend({ name: publicReportText(120) }).strict())
      .max(80),
    snapshots: z
      .array(
        workspaceSnapshotManifestSchema
          .omit({ untracked: true })
          .extend({
            untrackedFiles: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(3),
    review: workflowReviewSchema
      .extend({
        summary: publicReportText(4000),
        findings: z.array(publicReportText(1000)).max(20),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .refine(
    (report) => new TextEncoder().encode(JSON.stringify(report)).byteLength <= 65_536,
    "Execution report exceeds 64 KiB",
  );
export type ExecutionResultReport = z.infer<typeof executionResultReportSchema>;

export const reportExecutionResultSchema = z
  .object({
    workerId: z.uuid(),
    fencingToken: z.number().int().positive(),
    result: executionResultReportSchema,
  })
  .strict();
export type ReportExecutionResult = z.infer<typeof reportExecutionResultSchema>;
export const executionResultReceiptSchema = z
  .object({
    attemptId: z.uuid(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const runSummarySchema = z
  .object({
    id: z.uuid(),
    ticketId: z.uuid(),
    projectId: z.uuid(),
    title: z.string().max(160),
    status: ticketStatusSchema,
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type RunSummary = z.infer<typeof runSummarySchema>;
export const runListSchema = z.array(runSummarySchema).max(50);
export const runDeliverySchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.uuid(),
    attemptId: z.uuid(),
    baseRevision: gitCommitShaSchema,
    codeRevision: gitCommitShaSchema,
    patchHash: z.string().regex(/^[a-f0-9]{64}$/),
    resultDigest: z.string().regex(/^[a-f0-9]{64}$/),
    artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
    documentMarkdown: z
      .string()
      .min(1)
      .max(65_536)
      .refine(
        (value) => new TextEncoder().encode(value).byteLength <= 65_536,
        "Delivery document exceeds 64 KiB",
      ),
    documentDigest: z.string().regex(/^[a-f0-9]{64}$/),
    deliveryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type RunDelivery = z.infer<typeof runDeliverySchema>;
export const runDeliveryApprovalSchema = z
  .object({ delivery: runDeliverySchema, acceptedAt: z.iso.datetime() })
  .strict();
export const runDeliveryStateSchema = z
  .object({
    delivery: runDeliverySchema.nullable(),
    accepted: z.boolean(),
    reason: z.enum(["STATE_NOT_READY", "EVIDENCE_MISSING", "EVIDENCE_MISMATCH"]).nullable(),
  })
  .strict();
export type RunDeliveryState = z.infer<typeof runDeliveryStateSchema>;
export const approveRunDeliverySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    attemptId: z.uuid(),
    deliveryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type ApproveRunDelivery = z.infer<typeof approveRunDeliverySchema>;
export const runAttemptSchema = z
  .object({
    id: z.uuid(),
    sequence: z.number().int().positive(),
    status: z.enum(["RUNNING", "STOPPED", "COMPLETED", "FAILED", "CANCELLED"]),
    stoppedConfirmed: z.boolean(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    result: executionResultReportSchema.nullable(),
    resultDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    checkpoint: z
      .object({
        baseRevision: gitCommitShaSchema,
        codeRevision: gitCommitShaSchema.nullable(),
        snapshotId: z.uuid().nullable(),
        patchHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
        stoppedConfirmed: z.boolean(),
        reason: checkpointReasonSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();
export const runDetailSchema = runSummarySchema
  .extend({
    attempts: z.array(runAttemptSchema).max(50),
    controlAction: z.enum(["PAUSE", "CANCEL"]).nullable().optional(),
  })
  .strict();
export type RunDetail = z.infer<typeof runDetailSchema>;

export const requestRunControlSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    attemptId: z.uuid(),
    action: z.enum(["PAUSE", "CANCEL"]),
  })
  .strict();
export type RequestRunControl = z.infer<typeof requestRunControlSchema>;
export const requestRunResumeSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    attemptId: z.uuid(),
    artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type RequestRunResume = z.infer<typeof requestRunResumeSchema>;
export const runControlReceiptSchema = z
  .object({
    runId: z.uuid(),
    attemptId: z.uuid(),
    version: z.number().int().positive(),
    action: z.enum(["PAUSE", "CANCEL"]),
    pending: z.literal(true),
  })
  .strict();

export const agentRouteSchema = z
  .object({
    role: employeeRoleSchema,
    installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    provider: runtimeProviderSchema,
    model: z.string().trim().min(1).max(120),
    permissionMode: runtimePermissionModeSchema,
  })
  .strict();
export type AgentRoute = z.infer<typeof agentRouteSchema>;

export const providerHandoffSourceSchema = z
  .object({
    executionId: z.uuid(),
    provider: runtimeProviderSchema,
    status: runtimeExecutionStatusSchema,
    errorCode: runtimeErrorCodeSchema.nullable(),
    finishedAt: z.iso.datetime(),
  })
  .strict();
export type ProviderHandoffSource = z.infer<typeof providerHandoffSourceSchema>;

export const providerHandoffRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    handoffId: z.uuid(),
    source: providerHandoffSourceSchema,
    sourceStoppedConfirmed: z.literal(true),
    targetRole: employeeRoleSchema,
    repositoryPath: z.string().trim().min(1).max(4096),
    baseRevision: z.string().regex(/^[0-9a-f]{40}$/),
    snapshot: workspaceSnapshotSchema,
    objective: z.string().trim().min(1).max(4000),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
    configuration: factoryConfigurationSchema,
    guardState: runtimeGuardStateSchema,
    runtimeLimits: runtimeLimitsSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.snapshot.manifest.baseRevision !== request.baseRevision) {
      context.addIssue({
        code: "custom",
        message: "Snapshot must belong to the handoff base revision",
        path: ["snapshot", "manifest", "baseRevision"],
      });
    }
    if (Date.parse(request.snapshot.manifest.createdAt) < Date.parse(request.source.finishedAt)) {
      context.addIssue({
        code: "custom",
        message: "Snapshot must be captured after the source process stopped",
        path: ["snapshot", "manifest", "createdAt"],
      });
    }
  });
export type ProviderHandoffRequest = z.infer<typeof providerHandoffRequestSchema>;

export const providerHandoffResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    handoffId: z.uuid(),
    status: z.enum(["COMPLETED", "WAITING_PROVIDER", "PAUSED_LIMIT", "FAILED"]),
    route: agentRouteSchema.nullable(),
    workspace: workspaceCreateResultSchema.nullable(),
    restore: snapshotRestoreResultSchema.nullable(),
    execution: runtimeExecutionResultSchema.nullable(),
    guardState: runtimeGuardStateSchema,
    diagnostic: z.string().trim().min(1).max(1000),
  })
  .strict();
export type ProviderHandoffResult = z.infer<typeof providerHandoffResultSchema>;

export const factorySchedulingStateSchema = z
  .object({
    paused: z.boolean(),
    version: z.number().int().positive(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type FactorySchedulingState = z.infer<typeof factorySchedulingStateSchema>;
export const updateFactorySchedulingSchema = z
  .object({
    paused: z.boolean(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export type UpdateFactoryScheduling = z.infer<typeof updateFactorySchedulingSchema>;

/** Control-plane observations; never a provider eligibility or physical-stop proof. */
export const operationStatusSchema = z
  .object({
    observedAt: z.iso.datetime(),
    scheduling: factorySchedulingStateSchema.nullable(),
    heartbeatMaxAgeMs: z.literal(180_000),
    workersTruncated: z.boolean(),
    workers: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string().min(1).max(120),
            lastHeartbeatAt: z.iso.datetime(),
            heartbeatState: z.enum(["RECENT", "STALE", "OFFLINE", "CLOCK_SKEW"]),
          })
          .strict(),
      )
      .max(100),
    writerGuardInstalled: z.boolean(),
    unresolvedWriterCount: z.number().int().nonnegative(),
    writers: z
      .array(
        z
          .object({
            attemptId: z.uuid(),
            runId: z.uuid(),
            workerId: z.uuid(),
            leaseExpiresAt: z.iso.datetime(),
            leaseState: z.enum(["ACTIVE", "EXPIRED"]),
          })
          .strict(),
      )
      .max(10),
  })
  .strict()
  .refine(
    (value) => value.writers.length === Math.min(value.unresolvedWriterCount, 10),
    "Writer sample must match persisted unresolved count",
  );
export type OperationStatus = z.infer<typeof operationStatusSchema>;

function isProjectEventCursor(value: string): boolean {
  return /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n;
}
export const projectEventCursorSchema = z
  .string()
  .refine(isProjectEventCursor, "Invalid PostgreSQL event cursor");
export const projectEventSchema = z
  .object({
    projectId: z.uuid(),
    sequence: projectEventCursorSchema.refine((value) => value !== "0"),
    kind: z.enum(["TICKET_CHANGED", "RUN_CHANGED", "ATTEMPT_CHANGED", "CHECKPOINT_CHANGED"]),
    entityId: z.uuid(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type ProjectEvent = z.infer<typeof projectEventSchema>;
export const projectEventPageSchema = z
  .object({
    projectId: z.uuid(),
    after: projectEventCursorSchema,
    nextCursor: projectEventCursorSchema,
    events: z.array(projectEventSchema).max(100),
  })
  .strict()
  .refine((page) => {
    if (!isProjectEventCursor(page.after) || !isProjectEventCursor(page.nextCursor)) return false;
    let previous = BigInt(page.after);
    for (const event of page.events) {
      if (
        !isProjectEventCursor(event.sequence) ||
        event.projectId !== page.projectId ||
        BigInt(event.sequence) <= previous
      )
        return false;
      previous = BigInt(event.sequence);
    }
    return previous === BigInt(page.nextCursor);
  }, "Events must belong to project and advance cursor strictly");
export type ProjectEventPage = z.infer<typeof projectEventPageSchema>;

export const evidenceBackupPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    createdAt: z.iso.datetime(),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1).max(1024),
            mode: z.number().int().min(0).max(0o777),
            sizeBytes: z.number().int().nonnegative().max(67_108_864),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            contentBase64: z.string().max(89_478_488),
          })
          .strict(),
      )
      .min(1)
      .max(4096),
  })
  .strict();
export type EvidenceBackupPayload = z.infer<typeof evidenceBackupPayloadSchema>;
