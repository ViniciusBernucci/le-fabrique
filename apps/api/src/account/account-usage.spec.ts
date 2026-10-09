import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { accountUsage } from "./account-usage";

const stamp = new Date("2026-10-09T12:00:00Z");
function report(usage: { inputTokens: number; outputTokens: number } | null, provider = "codex") {
  return {
    schemaVersion: 1,
    workflowId: randomUUID(),
    status: "FAILED",
    reason: "RUNTIME_ROUTE_UNAVAILABLE",
    developerExecutions: 0,
    reviewerExecutions: 0,
    corrections: 0,
    checks: [],
    snapshots: [],
    review: null,
    diagnostic: "Fixture",
    runtimeObservations: [
      {
        executionId: randomUUID(),
        role: "DEVELOPER",
        installationId: "fixture",
        provider,
        modelRequested: "fixture-model",
        modelEffective: null,
        configurationVersion: 1,
        configurationObservedAt: stamp.toISOString(),
        status: "COMPLETED",
        errorCode: null,
        usage: usage ? { ...usage, cachedInputTokens: 0, reasoningOutputTokens: 0 } : null,
        startedAt: stamp.toISOString(),
        finishedAt: stamp.toISOString(),
      },
    ],
  };
}
function fixture(rows: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  return { tx: { attempt: { findMany } } as unknown as Prisma.TransactionClient, findMany };
}
it("scopes usage to current organization and granted projects, with no fabricated consumption", async () => {
  const { tx, findMany } = fixture([]);
  const result = await accountUsage(tx, "org-fixture", []);
  expect(result).toMatchObject({
    executionSeconds: 0,
    executionTimeIncomplete: false,
    aiUsage: null,
  });
  expect(findMany.mock.calls[0]?.[0].where.run.ticket.project).toEqual({
    organizationId: "org-fixture",
    id: { in: [] },
  });
});
it("reports observed zero tokens separately from missing usage and never counts unconfirmed time", async () => {
  const { tx } = fixture([
    {
      result: report({ inputTokens: 0, outputTokens: 0 }),
      startedAt: stamp,
      completedAt: new Date(stamp.getTime() + 12000),
      stoppedConfirmed: true,
    },
    { result: report(null), startedAt: stamp, completedAt: null, stoppedConfirmed: false },
  ]);
  const result = await accountUsage(tx, "org-fixture");
  expect(result).toMatchObject({
    executionSeconds: 12,
    executionTimeIncomplete: true,
    aiUsage: {
      inputTokens: 0,
      outputTokens: 0,
      incomplete: true,
      byProvider: [
        { provider: "codex", inputTokens: 0, outputTokens: 0, observations: 2, incomplete: true },
      ],
    },
  });
});
it("keeps wholly unknown usage and execution time nullable", async () => {
  const { tx } = fixture([
    { result: report(null), startedAt: stamp, completedAt: null, stoppedConfirmed: false },
  ]);
  expect(await accountUsage(tx, "org-fixture")).toMatchObject({
    executionSeconds: null,
    executionTimeIncomplete: true,
    aiUsage: null,
  });
});
