import { describe, expect, it } from "vitest";
import { readinessLabel } from "./health-view-model";

describe("readinessLabel", () => {
  it("shows a successful platform state", () => {
    expect(
      readinessLabel({
        status: "loaded",
        data: {
          status: "ok",
          service: "api",
          timestamp: "2026-09-30T00:00:00.000Z",
          checks: { database: "ok", redis: "ok" },
        },
      }).tone,
    ).toBe("success");
  });
});
