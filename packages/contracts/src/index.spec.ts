import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  createTicketSchema,
  healthResponseSchema,
  readyTicketSchema,
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
});
