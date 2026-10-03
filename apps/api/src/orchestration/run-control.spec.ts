import { requestRunControlSchema } from "@le-fabrique/contracts";
import { describe, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { OrchestrationService } from "./orchestration.service";
import { RunControlController } from "./run-control.controller";
import { RunControlService } from "./run-control.service";

function fixture() {
  const run = {
    id: crypto.randomUUID(),
    status: "RUNNING",
    version: 3,
    nextFencingToken: 2,
    controlAction: null as string | null,
  };
  const attempt = {
    id: crypto.randomUUID(),
    runId: run.id,
    workerId: crypto.randomUUID(),
    fencingToken: 2,
    status: "RUNNING",
    stoppedConfirmed: false,
    leaseExpiresAt: new Date(Date.now() + 60_000),
    run,
  };
  const tx = {
    run: {
      findUnique: vi.fn(async () => run),
      update: vi.fn(async ({ data }) => {
        run.controlAction = data.controlAction;
        run.version += 1;
        return run;
      }),
    },
    attempt: {
      findFirst: vi.fn(async () => attempt),
      findUnique: vi.fn(async () => attempt),
      update: vi.fn(async ({ data }) => ({ ...attempt, ...data })),
    },
  };
  const prisma = { $transaction: vi.fn((fn) => fn(tx)) };
  return {
    run,
    attempt,
    tx,
    prisma,
    service: new RunControlService(prisma as never),
    input: { expectedVersion: 3, attemptId: attempt.id, action: "PAUSE" as const },
  };
}
describe("administrative run control", () => {
  it("stores only intent and communicates it on fenced renewal", async () => {
    const f = fixture();
    await expect(f.service.request(f.run.id, f.input)).resolves.toMatchObject({
      pending: true,
      action: "PAUSE",
      version: 4,
    });
    expect(f.run.status).toBe("RUNNING");
    expect(f.attempt.stoppedConfirmed).toBe(false);
    expect(f.tx.attempt.update).not.toHaveBeenCalled();
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    const orchestration = new OrchestrationService(f.prisma as never);
    await expect(
      orchestration.renew(f.attempt.id, {
        workerId: f.attempt.workerId,
        fencingToken: 2,
        leaseDurationMs: 30_000,
      }),
    ).resolves.toMatchObject({ controlAction: "PAUSE" });
  });
  it("replays the same pending intent but refuses a divergent one", async () => {
    const f = fixture();
    await f.service.request(f.run.id, f.input);
    await f.service.request(f.run.id, f.input);
    expect(f.tx.run.update).toHaveBeenCalledOnce();
    await expect(f.service.request(f.run.id, { ...f.input, action: "CANCEL" })).rejects.toThrow(
      "Another control",
    );
  });
  it.each(["version", "attempt", "fence", "stopped", "terminal", "attemptStatus"])(
    "refuses %s without mutations",
    async (mode) => {
      const f = fixture();
      if (mode === "version") f.run.version++;
      if (mode === "attempt") f.input.attemptId = crypto.randomUUID();
      if (mode === "fence") f.attempt.fencingToken++;
      if (mode === "stopped") f.attempt.stoppedConfirmed = true;
      if (mode === "terminal") f.run.status = "VALIDATING";
      if (mode === "attemptStatus") f.attempt.status = "STOPPED";
      await expect(f.service.request(f.run.id, f.input)).rejects.toThrow();
      expect(f.tx.run.update).not.toHaveBeenCalled();
    },
  );
  it("rejects unknown fields/actions and protects the endpoint", () => {
    const f = fixture();
    expect(requestRunControlSchema.safeParse({ ...f.input, stoppedConfirmed: true }).success).toBe(
      false,
    );
    expect(requestRunControlSchema.safeParse({ ...f.input, action: "RESUME" }).success).toBe(false);
    expect(Reflect.getMetadata("__guards__", RunControlController)).toContain(AdminAuthGuard);
    const controller = new RunControlController(f.service, {} as never);
    expect(() => controller.request(f.run.id, { action: "PAUSE" })).toThrow("Invalid run control");
  });
});
