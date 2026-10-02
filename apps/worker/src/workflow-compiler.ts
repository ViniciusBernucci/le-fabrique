import {
  contextLimitsSchema,
  contextSourceRequestSchema,
  type DeveloperWorkflowRequest,
  developerWorkflowRequestSchema,
  type ExecutionSpecification,
  executionSpecificationSchema,
  runtimeGuardPolicySchema,
  runtimeLimitsSchema,
  sandboxLimitsSchema,
  snapshotLimitsSchema,
} from "@le-fabrique/contracts";
import { z } from "zod";

const trustedCheckSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    command: z.string().trim().min(1).max(4096),
    args: z.array(z.string().max(16_384)).max(200),
  })
  .strict();

/** Values resolved by trusted worker configuration; never read from the job payload. */
export const trustedWorkflowProfileSchema = z
  .object({
    projectId: z.uuid(),
    repositoryUrl: z.url(),
    repositoryPath: z.string().trim().min(1).max(4096),
    baseRevision: z.string().regex(/^[0-9a-f]{40}$/),
    contextSources: z.array(contextSourceRequestSchema).min(1).max(500),
    contextLimits: contextLimitsSchema,
    allowedChecks: z
      .array(trustedCheckSchema)
      .min(1)
      .max(20)
      .refine(
        (checks) => new Set(checks.map((check) => check.name)).size === checks.length,
        "Trusted check names must be unique",
      ),
    guardPolicy: runtimeGuardPolicySchema,
    runtimeLimits: runtimeLimitsSchema,
    sandboxLimits: sandboxLimitsSchema,
    snapshotLimits: snapshotLimitsSchema,
    maxCorrectionRounds: z.number().int().min(0).max(2),
    modelRequested: z.string().trim().min(1).max(120).nullable(),
  })
  .strict();

export type TrustedWorkflowProfile = z.infer<typeof trustedWorkflowProfileSchema>;

function pathIsWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function pathsOverlap(left: string, right: string): boolean {
  return pathIsWithin(left, right) || pathIsWithin(right, left);
}

export function compileWorkflowRequest(
  workflowId: string,
  specification: ExecutionSpecification,
  untrustedProfile: TrustedWorkflowProfile,
): DeveloperWorkflowRequest {
  const executionSpecification = executionSpecificationSchema.parse(specification);
  const profile = trustedWorkflowProfileSchema.parse(untrustedProfile);
  if (
    profile.projectId !== executionSpecification.project.id ||
    profile.repositoryUrl !== executionSpecification.project.repoUrl ||
    profile.baseRevision !== executionSpecification.project.baseRevision
  ) {
    throw new Error("Trusted workflow profile does not match execution specification");
  }

  const executionProfile = specification.project.definition.executionProfile;
  if (!executionProfile) throw new Error("Project execution profile is required");

  for (const source of profile.contextSources) {
    const normalized =
      !source.path.startsWith("/") &&
      !source.path.includes("\\") &&
      !source.path.split("/").some((segment) => segment === ".." || segment === ".");
    const allowed = executionSpecification.project.definition.allowedPaths.some((path) =>
      pathIsWithin(source.path, path),
    );
    const forbidden = executionSpecification.project.definition.forbiddenPaths.some((path) =>
      pathsOverlap(source.path, path),
    );
    if (!normalized || !allowed || forbidden) {
      throw new Error(`Context source is outside configured project paths: ${source.path}`);
    }
  }

  const contextSourceKey = (source: { path: string; role: string }) =>
    `${source.path}\0${source.role}`;
  const expectedContextSources = executionProfile.contextSources.map(contextSourceKey).sort();
  const actualContextSources = profile.contextSources.map(contextSourceKey).sort();
  if (JSON.stringify(expectedContextSources) !== JSON.stringify(actualContextSources)) {
    throw new Error("Trusted context sources do not match the approved project profile");
  }

  const allowedChecks = new Map(profile.allowedChecks.map((check) => [check.name, check]));
  if (allowedChecks.size !== executionProfile.approvedChecks.length) {
    throw new Error("Trusted checks do not match the approved project profile");
  }
  const checks = executionProfile.approvedChecks.map((check) => {
    const trusted = allowedChecks.get(check.name);
    if (
      !trusted ||
      trusted.command !== check.command ||
      JSON.stringify(trusted.args) !== JSON.stringify(check.args)
    ) {
      throw new Error(`Project check is not allowlisted: ${check.name}`);
    }
    return { ...trusted, environment: {} };
  });

  const objective = [
    executionSpecification.ticket.objective,
    `Project summary: ${executionSpecification.project.definition.summary}`,
    `External stack: ${executionSpecification.project.definition.externalStack}`,
    `Project instructions: ${executionSpecification.project.definition.instructions}`,
    `Allowed paths: ${executionSpecification.project.definition.allowedPaths.join(", ")}`,
    `Forbidden paths: ${executionSpecification.project.definition.forbiddenPaths.join(", ") || "none"}`,
  ].join("\n\n");

  return developerWorkflowRequestSchema.parse({
    schemaVersion: 1,
    workflowId,
    repositoryPath: profile.repositoryPath,
    baseRevision: executionSpecification.project.baseRevision,
    objective,
    acceptanceCriteria: executionSpecification.ticket.acceptanceCriteria,
    contextSources: profile.contextSources,
    contextLimits: profile.contextLimits,
    checks,
    writablePaths: executionSpecification.project.definition.allowedPaths,
    guardPolicy: profile.guardPolicy,
    runtimeLimits: profile.runtimeLimits,
    sandboxLimits: profile.sandboxLimits,
    snapshotLimits: profile.snapshotLimits,
    maxCorrectionRounds: profile.maxCorrectionRounds,
    modelRequested: profile.modelRequested,
  });
}
