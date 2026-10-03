import type { ExecutionSpecification } from "@le-fabrique/contracts";
import type { PreparedRepositoryCheckout } from "./repository-checkout";
import { type TrustedWorkflowProfile, trustedWorkflowProfileSchema } from "./workflow-compiler";

/** Factory-wide ceilings; project-specific commands and context still come from its READY snapshot. */
export function createTrustedWorkflowProfile(
  specification: ExecutionSpecification,
  checkout: PreparedRepositoryCheckout,
): TrustedWorkflowProfile {
  if (
    checkout.projectId !== specification.project.id ||
    checkout.repositoryUrl !== specification.project.repoUrl ||
    checkout.baseRevision !== specification.project.baseRevision
  ) {
    throw new Error("Prepared checkout does not match the immutable project specification");
  }
  const profile = specification.project.definition.executionProfile;
  if (!profile) throw new Error("Project execution profile is required");
  return trustedWorkflowProfileSchema.parse({
    projectId: specification.project.id,
    repositoryUrl: specification.project.repoUrl,
    repositoryPath: checkout.path,
    baseRevision: specification.project.baseRevision,
    contextSources: profile.contextSources,
    contextLimits: { maxFiles: 100, maxFileBytes: 262_144, maxTotalBytes: 2_097_152 },
    allowedChecks: profile.approvedChecks,
    guardPolicy: {
      schemaVersion: 1,
      maxAttempts: 8,
      maxElapsedMs: 1_800_000,
      maxProviderSwitches: 2,
      repeatedFailureLimit: 2,
      subscriptionOnly: true,
      monthlyApiBudget: 0,
      apiFallbackEnabled: false,
      paidExtrasAllowed: false,
    },
    runtimeLimits: { timeoutMs: 1_800_000, maxLogBytes: 1_048_576 },
    sandboxLimits: {
      timeoutMs: 1_800_000,
      maxLogBytes: 1_048_576,
      memoryBytes: 6_442_450_944,
      cpuQuotaPercent: 400,
      maxProcesses: 256,
      maxOpenFiles: 4096,
      maxFileBytes: 1_073_741_824,
    },
    snapshotLimits: { maxUntrackedFiles: 1000, maxArtifactBytes: 67_108_864 },
    maxCorrectionRounds: 2,
    modelRequested: null,
  });
}
