import { describe, expect, it } from "vitest";
import { executionResultReportSchema } from "./index";

function result() {
  return {
    schemaVersion: 1,
    workflowId: crypto.randomUUID(),
    status: "FAILED",
    reason: "RUNTIME_ROUTE_UNAVAILABLE",
    developerExecutions: 0,
    reviewerExecutions: 0,
    corrections: 0,
    checks: [],
    snapshots: [],
    review: null,
    diagnostic: "No route",
    runtimeObservations: [],
  };
}
describe("public execution results", () => {
  it("rejects private fields instead of publishing runtime payloads", () => {
    expect(() =>
      executionResultReportSchema.parse({
        ...result(),
        workspace: { workspacePath: "/tmp/private" },
      }),
    ).toThrow();
    expect(() =>
      executionResultReportSchema.parse({ ...result(), providerSessionId: "private" }),
    ).toThrow();
  });
  it("redacts known credentials and host paths in model text", () => {
    const diagnostic =
      "Bearer synthetic-token WORKER_API_TOKEN=synthetic-private sk-synthetic123456789 /var/lib/worker/auth.json";
    const report = executionResultReportSchema.parse({ ...result(), diagnostic });
    expect(report.diagnostic).not.toContain("synthetic");
    expect(report.diagnostic).not.toContain("/var/lib");
    expect(executionResultReportSchema.parse(report)).toEqual(report);
  });
  it("keeps unknown model and usage explicit", () => {
    const timestamp = new Date().toISOString();
    const report = executionResultReportSchema.parse({
      ...result(),
      runtimeObservations: [
        {
          executionId: crypto.randomUUID(),
          role: "DEVELOPER",
          installationId: "configured-account",
          provider: "codex",
          modelRequested: "selected-in-ui",
          modelEffective: null,
          configurationVersion: 3,
          configurationObservedAt: timestamp,
          status: "COMPLETED",
          errorCode: null,
          usage: null,
          startedAt: timestamp,
          finishedAt: timestamp,
        },
      ],
    });
    expect(report.runtimeObservations[0]).toMatchObject({ modelEffective: null, usage: null });
  });
});
