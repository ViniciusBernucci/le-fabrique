import type {
  DeveloperWorkflowResult,
  ExecutionSpecification,
  OrchestrationClaim,
  OrchestrationJob,
  OrchestrationState,
} from "@le-fabrique/contracts";
import { executionResultReportSchema, orchestrationJobSchema } from "@le-fabrique/contracts";
import type { ControlClient } from "./control-client";
import { LeaseAuthorityLostError, LeaseGuard } from "./lease-guard";
import type { PreparedRepositoryCheckout } from "./repository-checkout";
import type { TrustedWorkflowProfile } from "./workflow-compiler";

export interface ExecutionWorkflow {
  execute(signal: AbortSignal): Promise<DeveloperWorkflowResult>;
  cancelActive(): Promise<boolean>;
}

export interface ExecutionProcessorDependencies {
  control: Pick<ControlClient, "claim" | "renew" | "checkpoint" | "complete" | "reportResult">;
  leaseDurationMs: number;
  prepareCheckout: (
    job: OrchestrationJob,
    claim: OrchestrationClaim,
    signal: AbortSignal,
  ) => Promise<PreparedRepositoryCheckout>;
  createProfile: (
    job: OrchestrationJob,
    checkout: PreparedRepositoryCheckout,
  ) => TrustedWorkflowProfile;
  createWorkflow: (
    profile: TrustedWorkflowProfile,
    specification: ExecutionSpecification,
    workflowId: string,
  ) => ExecutionWorkflow;
}

export type ExecutionProcessorResult = {
  runId: string;
  attemptId: string;
  replayed: boolean;
  status: OrchestrationState["status"] | "REPLAY_SKIPPED";
  workflowStatus: DeveloperWorkflowResult["status"] | null;
  reason:
    | DeveloperWorkflowResult["reason"]
    | "LEASE_LOST"
    | "WORKER_STOPPED"
    | "EXECUTION_SETUP_FAILED"
    | null;
  snapshotId: string | null;
  patchHash: string | null;
};

export class WriterQuiescenceError extends Error {
  constructor() {
    super("Execution did not confirm writer quiescence; attempt remains fenced");
    this.name = "WriterQuiescenceError";
  }
}

export async function processOrchestrationExecution(
  payload: OrchestrationJob,
  dependencies: ExecutionProcessorDependencies,
  shutdownSignal?: AbortSignal,
): Promise<ExecutionProcessorResult> {
  shutdownSignal?.throwIfAborted();
  const job = orchestrationJobSchema.strict().parse(payload);
  const specification = job.executionSpecification;
  if (!job.baseRevision || !specification) {
    throw new Error("Execution job is missing its immutable READY specification");
  }

  const claim = await dependencies.control.claim(job, dependencies.leaseDurationMs);
  if (claim.replayed) {
    return {
      runId: claim.runId,
      attemptId: claim.attemptId,
      replayed: true,
      status: "REPLAY_SKIPPED",
      workflowStatus: null,
      reason: null,
      snapshotId: null,
      patchHash: null,
    };
  }

  let workflow: ExecutionWorkflow | undefined;
  let workflowResult: DeveloperWorkflowResult | undefined;
  const guard = new LeaseGuard({
    fencingToken: claim.fencingToken,
    leaseDurationMs: dependencies.leaseDurationMs,
    initialLeaseExpiresAt: claim.leaseExpiresAt,
    renew: async (fencingToken) =>
      await dependencies.control.renew(claim.attemptId, {
        fencingToken,
        leaseDurationMs: dependencies.leaseDurationMs,
      }),
    stopWriter: async () => (workflow ? await workflow.cancelActive() : true),
  });

  try {
    workflowResult = await guard.execute(async (leaseSignal) => {
      const signal = shutdownSignal ? AbortSignal.any([leaseSignal, shutdownSignal]) : leaseSignal;
      signal.throwIfAborted();
      const checkout = await dependencies.prepareCheckout(job, claim, signal);
      signal.throwIfAborted();
      const profile = dependencies.createProfile(job, checkout);
      workflow = dependencies.createWorkflow(profile, specification, claim.attemptId);
      workflowResult = await workflow.execute(signal);
      return workflowResult;
    });
  } catch (error) {
    if (error instanceof LeaseAuthorityLostError) {
      if (!error.writerQuiescent) throw new WriterQuiescenceError();
      const checkpoint = await dependencies.control.checkpoint(claim.attemptId, {
        fencingToken: claim.fencingToken,
        baseRevision: specification.project.baseRevision,
        codeRevision:
          workflowResult?.snapshots.at(-1)?.headRevision ?? specification.project.baseRevision,
        snapshotId: workflowResult?.snapshots.at(-1)?.snapshotId ?? null,
        patchHash: workflowResult?.snapshots.at(-1)?.manifestHash ?? null,
        reason: "CANCELLED",
        stoppedConfirmed: true,
      });
      const completed = await dependencies.control.complete(claim.attemptId, {
        fencingToken: claim.fencingToken,
        outcome: "CANCELLED",
      });
      return resultFromState(
        checkpoint.runId,
        claim.attemptId,
        completed.status,
        false,
        null,
        "LEASE_LOST",
        null,
        null,
      );
    }

    const stopped = workflow ? await workflow.cancelActive().catch(() => false) : true;
    if (!stopped) throw new WriterQuiescenceError();
    const outcome = shutdownSignal?.aborted ? "CANCELLED" : "FAILED";
    const checkpoint = await dependencies.control.checkpoint(claim.attemptId, {
      fencingToken: claim.fencingToken,
      baseRevision: specification.project.baseRevision,
      codeRevision:
        workflowResult?.snapshots.at(-1)?.headRevision ?? specification.project.baseRevision,
      snapshotId: workflowResult?.snapshots.at(-1)?.snapshotId ?? null,
      patchHash: workflowResult?.snapshots.at(-1)?.manifestHash ?? null,
      reason: outcome,
      stoppedConfirmed: true,
    });
    const completed = await dependencies.control.complete(claim.attemptId, {
      fencingToken: claim.fencingToken,
      outcome,
    });
    return resultFromState(
      checkpoint.runId,
      claim.attemptId,
      completed.status,
      false,
      null,
      shutdownSignal?.aborted ? "WORKER_STOPPED" : "EXECUTION_SETUP_FAILED",
      null,
      null,
    );
  }

  const latestSnapshot = workflowResult.snapshots.at(-1);
  const stoppedConfirmed = workflowResult.checks.every((check) => check.stoppedConfirmed);
  if (!stoppedConfirmed) throw new WriterQuiescenceError();
  const {
    workspace: _workspace,
    contextManifest: _context,
    guardState: _guard,
    snapshots,
    ...publicResult
  } = workflowResult;
  const result = executionResultReportSchema.parse({
    ...publicResult,
    snapshots: snapshots.map(({ untracked, ...manifest }) => ({
      ...manifest,
      untrackedFiles: untracked.length,
    })),
  });
  await dependencies.control.reportResult(claim.attemptId, {
    fencingToken: claim.fencingToken,
    result,
  });
  const approved =
    workflowResult.status === "AWAITING_HUMAN" && workflowResult.reason === "APPROVED";
  const checkpointReason = approved
    ? "COMPLETED"
    : workflowResult.status === "PAUSED_LIMIT"
      ? "PAUSED"
      : "FAILED";
  const checkpoint = await dependencies.control.checkpoint(claim.attemptId, {
    fencingToken: claim.fencingToken,
    baseRevision: specification.project.baseRevision,
    codeRevision: latestSnapshot?.headRevision ?? workflowResult.workspace.revision,
    snapshotId: latestSnapshot?.snapshotId ?? null,
    patchHash: latestSnapshot?.manifestHash ?? null,
    reason: checkpointReason,
    stoppedConfirmed,
  });

  const outcome = approved
    ? "VALIDATING"
    : workflowResult.status === "PAUSED_LIMIT"
      ? "PAUSED_LIMIT"
      : "FAILED";
  const completed = await dependencies.control.complete(claim.attemptId, {
    fencingToken: claim.fencingToken,
    outcome,
  });
  return resultFromState(
    checkpoint.runId,
    claim.attemptId,
    completed.status,
    false,
    workflowResult.status,
    workflowResult.reason,
    latestSnapshot?.snapshotId ?? null,
    latestSnapshot?.manifestHash ?? null,
  );
}

function resultFromState(
  runId: string,
  attemptId: string,
  status: OrchestrationState["status"],
  replayed: boolean,
  workflowStatus: DeveloperWorkflowResult["status"] | null,
  reason: ExecutionProcessorResult["reason"],
  snapshotId: string | null,
  patchHash: string | null,
): ExecutionProcessorResult {
  return { runId, attemptId, replayed, status, workflowStatus, reason, snapshotId, patchHash };
}
