import { describe, expect, it, vi } from "vitest";
import { processOrchestrationFixture } from "./orchestration.processor";

function orchestrationJob() {
  const projectId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();
  return {
    schemaVersion: 1 as const,
    eventId: crypto.randomUUID(),
    ticketId,
    projectId,
    ticketVersion: 2,
    baseRevision: "a".repeat(40),
    projectDefinitionVersion: 3,
    executionSpecification: {
      schemaVersion: 1 as const,
      project: {
        id: projectId,
        name: "Projeto externo",
        repoUrl: "https://example.test/repository.git",
        baseRevision: "a".repeat(40),
        definitionVersion: 3,
        definition: {
          summary: "Projeto configurado",
          externalStack: "Stack externa",
          instructions: "Nao executar deploy.",
          allowedPaths: ["src"],
          forbiddenPaths: ["secrets"],
          checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"] }],
        },
      },
      ticket: {
        id: ticketId,
        version: 2,
        title: "Incremento",
        objective: "Implementar incremento",
        acceptanceCriteria: ["Checks passam"],
      },
    },
  };
}

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
      processOrchestrationFixture(orchestrationJob(), control as never),
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

  it("fails safely before claim without an immutable execution specification", async () => {
    const control = { claim: vi.fn(), checkpoint: vi.fn(), complete: vi.fn() };
    const job = orchestrationJob();
    await expect(
      processOrchestrationFixture({ ...job, executionSpecification: null }, control as never),
    ).rejects.toThrow("Fixture execution specification is unavailable");
    expect(control.claim).not.toHaveBeenCalled();
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
