import { describe, expect, it } from "vitest";
import { processProbe } from "./probe.processor";

describe("processProbe", () => {
  it("validates the queue payload before processing", () => {
    const result = processProbe({
      correlationId: "7749fd12-1fba-4fd4-ace0-a713c014c70d",
      requestedAt: "2026-09-30T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      correlationId: "7749fd12-1fba-4fd4-ace0-a713c014c70d",
      health: { status: "ok", service: "worker" },
    });
  });

  it("rejects invalid queue input", () => {
    expect(() => processProbe({ correlationId: "bad", requestedAt: "bad" })).toThrow();
  });
});
