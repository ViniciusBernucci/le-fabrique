import { runDetailSchema } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RunResultView } from "./RunPanel";

it("shows unknown model/usage without inferring success or rendering model HTML", () => {
  const timestamp = new Date().toISOString();
  const attemptId = crypto.randomUUID();
  const run = runDetailSchema.parse({
    id: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title: "Configured ticket",
    status: "VALIDATING",
    version: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: [
      {
        id: attemptId,
        sequence: 1,
        status: "COMPLETED",
        stoppedConfirmed: true,
        startedAt: timestamp,
        completedAt: timestamp,
        checkpoint: null,
        resultDigest: "a".repeat(64),
        result: {
          schemaVersion: 1,
          workflowId: attemptId,
          status: "AWAITING_HUMAN",
          reason: "APPROVED",
          developerExecutions: 1,
          reviewerExecutions: 1,
          corrections: 0,
          checks: [],
          snapshots: [],
          handoffs: [
            {
              role: "DEVELOPER",
              fromInstallationId: "first-account",
              toInstallationId: "second-account",
              sourceExecutionId: crypto.randomUUID(),
              reason: "RATE_LIMITED",
              snapshotId: crypto.randomUUID(),
              manifestHash: "c".repeat(64),
              createdAt: timestamp,
            },
          ],
          review: {
            schemaVersion: 1,
            verdict: "APPROVE",
            summary: "<script>alert('untrusted')</script>",
            findings: [],
          },
          diagnostic: "Checks completed",
          runtimeObservations: [
            {
              executionId: crypto.randomUUID(),
              role: "DEVELOPER",
              installationId: "ui-account",
              provider: "codex",
              modelRequested: "selected-in-ui",
              modelEffective: null,
              usage: null,
              configurationVersion: 3,
              configurationObservedAt: timestamp,
              status: "COMPLETED",
              errorCode: null,
              startedAt: timestamp,
              finishedAt: timestamp,
            },
          ],
        },
      },
    ],
  });
  const html = renderToStaticMarkup(<RunResultView run={run} />);
  expect(html).toContain("Aguarda validação humana");
  expect(html).toContain("Não informado pelo cliente");
  expect(html).toContain("Uso não informado pelo cliente");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("first-account");
  expect(html).toContain("second-account");
  expect(html).toContain("RATE_LIMITED");
});
