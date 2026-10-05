import { createHash } from "node:crypto";
import {
  executionArtifactSchema,
  executionResultReportSchema,
  resumeEvidenceSchema,
  verifyExecutionArtifact,
} from "@le-fabrique/contracts";
import { ConflictException } from "@nestjs/common";
import type { Attempt, Checkpoint } from "@prisma/client";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function stoppedResumeEvidence(attempt: Attempt & { checkpoint: Checkpoint | null }) {
  if (
    !attempt.stoppedConfirmed ||
    !attempt.checkpoint?.stoppedConfirmed ||
    !["STOPPED", "FAILED", "CANCELLED"].includes(attempt.status)
  )
    throw new ConflictException("Resume requires a terminal, confirmed stopped writer");
  const result = executionResultReportSchema.parse(attempt.result);
  const artifact = executionArtifactSchema.parse(attempt.artifact);
  verifyExecutionArtifact(
    artifact,
    (encoded) => Buffer.from(encoded, "base64"),
    (bytes) => createHash("sha256").update(bytes).digest("hex"),
  );
  const snapshot = result.snapshots.at(-1);
  const { untracked, ...manifest } = artifact.manifest;
  const projected = { ...manifest, untrackedFiles: untracked.length };
  const reason =
    result.status === "WAITING_PROVIDER"
      ? "WAITING_PROVIDER"
      : result.status === "PAUSED"
        ? "OPERATOR_PAUSED"
        : result.status === "PAUSED_LIMIT"
          ? "PAUSED"
          : result.status === "CANCELLED"
            ? "CANCELLED"
            : "FAILED";
  if (
    !snapshot ||
    !["WAITING_PROVIDER", "PAUSED", "PAUSED_LIMIT", "FAILED", "CANCELLED"].includes(
      result.status,
    ) ||
    result.workflowId !== attempt.id ||
    result.checks.some((check) => !check.stoppedConfirmed) ||
    digest(result) !== attempt.resultDigest ||
    digest(artifact) !== attempt.artifactDigest ||
    Object.keys(projected).some(
      (key) => projected[key as keyof typeof projected] !== snapshot[key as keyof typeof snapshot],
    ) ||
    attempt.checkpoint.reason !== reason ||
    attempt.checkpoint.baseRevision !== snapshot.baseRevision ||
    attempt.checkpoint.codeRevision !== snapshot.headRevision ||
    attempt.checkpoint.snapshotId !== snapshot.snapshotId ||
    attempt.checkpoint.patchHash !== snapshot.manifestHash
  )
    throw new ConflictException("Resume evidence does not match the stopped checkpoint");
  return resumeEvidenceSchema.parse({
    attemptId: attempt.id,
    fencingToken: attempt.fencingToken,
    resultDigest: attempt.resultDigest,
    artifactDigest: attempt.artifactDigest,
    snapshot,
  });
}
