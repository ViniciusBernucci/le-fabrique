import type { OrchestrationJob } from "@le-fabrique/contracts";
import { orchestrationJobSchema } from "@le-fabrique/contracts";
import type { ControlClient } from "./control-client";

export async function processOrchestrationFixture(
  payload: OrchestrationJob,
  control: Pick<ControlClient, "claim" | "checkpoint" | "complete">,
): Promise<{ runId: string; attemptId: string }> {
  const job = orchestrationJobSchema.parse(payload);
  if (!job.baseRevision) throw new Error("Fixture base revision is unavailable");
  const claim = await control.claim(job);
  await control.checkpoint(claim.attemptId, {
    fencingToken: claim.fencingToken,
    baseRevision: job.baseRevision,
    codeRevision: job.baseRevision,
    snapshotId: null,
    patchHash: null,
    reason: "COMPLETED",
    stoppedConfirmed: true,
  });
  await control.complete(claim.attemptId, {
    fencingToken: claim.fencingToken,
    outcome: "VALIDATING",
  });
  return { runId: claim.runId, attemptId: claim.attemptId };
}
