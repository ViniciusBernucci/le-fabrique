import { describe, expect, it, vi } from "vitest";
import { processOrchestrationFixture } from "./orchestration.processor";

describe("processOrchestrationFixture", () => {
  it("claims, checkpoints stopped state and completes without invoking a provider", async () => {
    const runId = crypto.randomUUID();
    const attemptId = crypto.randomUUID();
    const control = {
      claim: vi.fn().mockResolvedValue({ runId, attemptId, fencingToken: 3 }),
      checkpoint: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
    };
    await expect(
      processOrchestrationFixture(
        {
          schemaVersion: 1,
          eventId: crypto.randomUUID(),
          ticketId: crypto.randomUUID(),
          projectId: crypto.randomUUID(),
          ticketVersion: 2,
          baseRevision: "a".repeat(40),
        },
        control as never,
      ),
    ).resolves.toEqual({ runId, attemptId });
    expect(control.checkpoint).toHaveBeenCalledWith(
      attemptId,
      expect.objectContaining({ fencingToken: 3, stoppedConfirmed: true }),
    );
    expect(control.complete).toHaveBeenCalledWith(attemptId, {
      fencingToken: 3,
      outcome: "VALIDATING",
    });
  });

  it("fails safely before claim when the project has no resolved base revision", async () => {
    const control = { claim: vi.fn(), checkpoint: vi.fn(), complete: vi.fn() };
    await expect(
      processOrchestrationFixture(
        {
          schemaVersion: 1,
          eventId: crypto.randomUUID(),
          ticketId: crypto.randomUUID(),
          projectId: crypto.randomUUID(),
          ticketVersion: 2,
          baseRevision: null,
        },
        control as never,
      ),
    ).rejects.toThrow("Fixture base revision is unavailable");
    expect(control.claim).not.toHaveBeenCalled();
  });
});
