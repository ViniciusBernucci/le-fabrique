import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  createTicketSchema,
  healthResponseSchema,
  readyTicketSchema,
  runtimeEventSchema,
  runtimeExecutionRequestSchema,
  runtimeExecutionResultSchema,
  workerProbeJobSchema,
  workerRegistrationSchema,
} from "./index.js";

describe("shared contracts", () => {
  it("accepts a valid health response", () => {
    expect(
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        timestamp: "2026-09-30T00:00:00.000Z",
      }),
    ).toBeDefined();
  });

  it("rejects a queue payload without a valid correlation id", () => {
    expect(() =>
      workerProbeJobSchema.parse({ requestedAt: "2026-09-30T00:00:00.000Z", correlationId: "x" }),
    ).toThrow();
  });

  it("validates control-plane commands at runtime", () => {
    expect(
      createProjectSchema.parse({
        name: "Projeto sintético",
        repoUrl: "https://example.test/repository.git",
        baseRef: "main",
      }),
    ).toBeDefined();
    expect(() =>
      createTicketSchema.parse({ title: "Ticket", objective: "Objetivo", acceptanceCriteria: [] }),
    ).toThrow();
    expect(() => readyTicketSchema.parse({ expectedVersion: 0 })).toThrow();
  });

  it("rejects an incomplete worker identity", () => {
    expect(() =>
      workerRegistrationSchema.parse({ id: crypto.randomUUID(), name: "worker" }),
    ).toThrow();
  });

  it("validates runtime requests, events and nullable observations", () => {
    const executionId = crypto.randomUUID();
    expect(
      runtimeExecutionRequestSchema.parse({
        schemaVersion: 1,
        executionId,
        workspacePath: "/tmp/fixture",
        prompt: "inspect fixture",
        permissionMode: "READ_ONLY",
        limits: { timeoutMs: 1_000, maxLogBytes: 4_096 },
      }),
    ).toMatchObject({ modelRequested: null });
    expect(() =>
      runtimeEventSchema.parse({
        type: "progress",
        executionId,
        timestamp: "2026-09-30T00:00:00.000Z",
        category: "reasoning",
      }),
    ).toThrow();
    expect(
      runtimeExecutionResultSchema.parse({
        schemaVersion: 1,
        executionId,
        provider: "codex",
        status: "COMPLETED",
        exitCode: 0,
        providerSessionId: "session",
        modelRequested: null,
        modelEffective: null,
        finalMessage: "done",
        usage: null,
        error: null,
        startedAt: "2026-09-30T00:00:00.000Z",
        finishedAt: "2026-09-30T00:00:01.000Z",
      }),
    ).toBeDefined();
  });
});
