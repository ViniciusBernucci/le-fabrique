import { runDetailSchema } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RunResumePanel } from "./RunResumePanel";

it("only offers explicit confirmed snapshot resume for a stopped terminal attempt", () => {
  const time = new Date().toISOString();
  const run = runDetailSchema.parse({
    id: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title: "Ticket",
    status: "PAUSED",
    version: 2,
    createdAt: time,
    updatedAt: time,
    attempts: [],
  });
  expect(renderToStaticMarkup(<RunResumePanel token="synthetic" run={run} />)).toBe("");
  // Without persisted result/snapshot, even a confirmed stop does not authorize restoration.
  run.attempts.push({
    id: crypto.randomUUID(),
    sequence: 1,
    status: "STOPPED",
    stoppedConfirmed: true,
    startedAt: time,
    completedAt: time,
    result: null,
    resultDigest: null,
    checkpoint: {
      baseRevision: "a".repeat(40),
      codeRevision: "a".repeat(40),
      snapshotId: null,
      patchHash: null,
      reason: "OPERATOR_PAUSED",
      stoppedConfirmed: true,
    },
  });
  expect(renderToStaticMarkup(<RunResumePanel token="synthetic" run={run} />)).toBe("");
});

it("requires new attempt authorization and discloses renewed limits without auto-submit", () => {
  const time = new Date().toISOString();
  const id = crypto.randomUUID();
  const snapshot = {
    schemaVersion: 1,
    snapshotId: crypto.randomUUID(),
    baseRevision: "a".repeat(40),
    headRevision: "a".repeat(40),
    patchBytes: 0,
    patchSha256: "b".repeat(64),
    untrackedFiles: 0,
    totalArtifactBytes: 0,
    createdAt: time,
    manifestHash: "c".repeat(64),
  };
  const run = runDetailSchema.parse({
    id: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title: "Ticket",
    status: "PAUSED",
    version: 2,
    createdAt: time,
    updatedAt: time,
    attempts: [
      {
        id,
        sequence: 1,
        status: "STOPPED",
        stoppedConfirmed: true,
        startedAt: time,
        completedAt: time,
        resultDigest: "d".repeat(64),
        checkpoint: {
          baseRevision: snapshot.baseRevision,
          codeRevision: snapshot.headRevision,
          snapshotId: snapshot.snapshotId,
          patchHash: snapshot.manifestHash,
          reason: "OPERATOR_PAUSED",
          stoppedConfirmed: true,
        },
        result: {
          schemaVersion: 1,
          workflowId: id,
          status: "PAUSED",
          reason: "OPERATOR_PAUSED",
          developerExecutions: 1,
          reviewerExecutions: 0,
          corrections: 0,
          checks: [],
          snapshots: [snapshot],
          review: null,
          diagnostic: "Paused",
          runtimeObservations: [],
        },
      },
    ],
  });
  const html = renderToStaticMarkup(<RunResumePanel token="synthetic" run={run} />);
  expect(html).toContain("Autorizo nova tentativa");
  expect(html).toContain("reiniciam para a tentativa autorizada");
  expect(html).toContain('disabled=""');
  run.status = "BLOCKED_RECOVERY";
  expect(renderToStaticMarkup(<RunResumePanel token="synthetic" run={run} />)).toBe("");
});
