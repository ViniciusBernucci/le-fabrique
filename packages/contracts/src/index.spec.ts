import { describe, expect, it } from "vitest";
import { healthResponseSchema, workerProbeJobSchema } from "./index.js";

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
});
