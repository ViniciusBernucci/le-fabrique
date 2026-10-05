import { describe, expect, it, vi } from "vitest";
import { WorkerIdentityService } from "./worker-identity.service";

describe("WorkerIdentityService", () => {
  it("records heartbeat only for a registered worker", async () => {
    const prisma = { workerIdentity: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const service = new WorkerIdentityService(prisma as never);
    await expect(service.heartbeat("00000000-0000-4000-8000-000000000001")).resolves.toMatchObject({
      workerId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("rejects heartbeat before registration", async () => {
    const prisma = { workerIdentity: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };
    const service = new WorkerIdentityService(prisma as never);
    await expect(service.heartbeat("00000000-0000-4000-8000-000000000001")).rejects.toThrow(
      "Worker not registered",
    );
  });
});
