import { describe, expect, it, vi } from "vitest";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports readiness when both dependencies respond", async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ value: 1 }]) };
    const redis = {
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
    };
    const service = new HealthService(prisma as never, redis as never);

    await expect(service.readiness()).resolves.toMatchObject({
      status: "ok",
      checks: { database: "ok", redis: "ok" },
    });
  });

  it("reports an error when a dependency is unavailable", async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error("offline")) };
    const redis = {
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
    };
    const service = new HealthService(prisma as never, redis as never);

    await expect(service.readiness()).resolves.toMatchObject({
      status: "error",
      checks: { database: "error", redis: "ok" },
    });
  });
});
