import { describe, expect, it, vi } from "vitest";
import { ControlService } from "./control.service";

const now = new Date("2026-09-30T12:00:00.000Z");
const definitionInput = {
  summary: "Projeto configurado no painel",
  externalStack: "Stack externa preservada",
  instructions: "Nao executar deploy.",
  allowedPaths: ["src"],
  forbiddenPaths: ["secrets"],
  checks: [{ name: "test", command: "/usr/bin/npm", args: ["test"] }],
};

const draft = {
  id: "00000000-0000-4000-8000-000000000002",
  projectId: "00000000-0000-4000-8000-000000000001",
  title: "Ticket sintético",
  objective: "Validar controle",
  acceptanceCriteria: ["Outbox única"],
  status: "DRAFT",
  version: 1,
  createdAt: now,
  updatedAt: now,
  project: {
    name: "Projeto externo",
    repoUrl: "https://example.test/repository.git",
    baseRef: "a".repeat(40),
    definition: { version: 3, configuration: definitionInput },
  },
};

describe("ControlService", () => {
  it("moves a ticket to READY and writes one deduplicated outbox event", async () => {
    const ready = { ...draft, status: "READY", version: 2 };
    const transaction = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue(draft),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(ready),
      },
      outboxEvent: { findUnique: vi.fn(), create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(service.markReady(draft.id, 1)).resolves.toMatchObject({
      status: "READY",
      version: 2,
    });
    expect(transaction.outboxEvent.create).toHaveBeenCalledOnce();
    expect(transaction.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deduplicationKey: `ticket:${draft.id}:ready`,
          payload: expect.objectContaining({
            baseRevision: "a".repeat(40),
            projectDefinitionVersion: 3,
            executionSpecification: expect.objectContaining({
              project: expect.objectContaining({
                id: draft.projectId,
                definitionVersion: 3,
                definition: definitionInput,
              }),
              ticket: expect.objectContaining({ id: draft.id, version: 2 }),
            }),
          }),
        }),
      }),
    );
  });

  it("returns an already-ready ticket when its outbox event exists", async () => {
    const ready = { ...draft, status: "READY", version: 2 };
    const transaction = {
      ticket: { findUnique: vi.fn().mockResolvedValue(ready) },
      outboxEvent: { findUnique: vi.fn().mockResolvedValue({ id: "event" }) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(service.markReady(draft.id, 1)).resolves.toMatchObject({
      status: "READY",
      version: 2,
    });
  });

  it("rejects READY before mutation when the project base is not an exact revision", async () => {
    const unresolved = { ...draft, project: { baseRef: "main", definition: { version: 3 } } };
    const transaction = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue(unresolved),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      outboxEvent: { findUnique: vi.fn(), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(service.markReady(draft.id, 1)).rejects.toThrow(
      "Project base revision must be an exact lowercase 40-character commit SHA",
    );
    expect(transaction.ticket.updateMany).not.toHaveBeenCalled();
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("rejects READY before mutation when the project definition is absent", async () => {
    const undefinedProject = { ...draft, project: { baseRef: "a".repeat(40), definition: null } };
    const transaction = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue(undefinedProject),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      outboxEvent: { findUnique: vi.fn(), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(new ControlService(prisma as never).markReady(draft.id, 1)).rejects.toThrow(
      "Project definition must be configured before READY",
    );
    expect(transaction.ticket.updateMany).not.toHaveBeenCalled();
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("creates the first project definition at version one", async () => {
    const stored = {
      projectId: draft.projectId,
      version: 1,
      configuration: definitionInput,
      createdAt: now,
      updatedAt: now,
    };
    const transaction = {
      project: { findUnique: vi.fn().mockResolvedValue({ id: draft.projectId, definition: null }) },
      projectDefinition: { create: vi.fn().mockResolvedValue(stored) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new ControlService(prisma as never).putProjectDefinition(draft.projectId, {
        expectedVersion: 0,
        definition: definitionInput,
      }),
    ).resolves.toMatchObject({ projectId: draft.projectId, version: 1, ...definitionInput });
  });

  it("preserves a project definition when its expected version is obsolete", async () => {
    const transaction = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: draft.projectId,
          definition: { version: 2 },
        }),
      },
      projectDefinition: { updateMany: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };

    await expect(
      new ControlService(prisma as never).putProjectDefinition(draft.projectId, {
        expectedVersion: 1,
        definition: definitionInput,
      }),
    ).rejects.toThrow("Project definition version changed");
    expect(transaction.projectDefinition.updateMany).not.toHaveBeenCalled();
  });

  it("updates a project base revision with optimistic comparison", async () => {
    const project = {
      id: draft.projectId,
      name: "Projeto",
      repoUrl: "https://example.test/repository.git",
      baseRef: "main",
      createdAt: now,
      updatedAt: now,
    };
    const revision = "b".repeat(40);
    const transaction = {
      project: {
        findUnique: vi.fn().mockResolvedValue(project),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...project, baseRef: revision }),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(
      service.updateProjectBaseRevision(project.id, {
        expectedBaseRef: "main",
        baseRevision: revision,
      }),
    ).resolves.toMatchObject({ baseRef: revision });
    expect(transaction.project.updateMany).toHaveBeenCalledWith({
      where: { id: project.id, baseRef: "main" },
      data: { baseRef: revision },
    });
  });

  it("preserves the project when the expected base reference changed", async () => {
    const project = {
      id: draft.projectId,
      name: "Projeto",
      repoUrl: "https://example.test/repository.git",
      baseRef: "develop",
      createdAt: now,
      updatedAt: now,
    };
    const transaction = {
      project: {
        findUnique: vi.fn().mockResolvedValue(project),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(
      service.updateProjectBaseRevision(project.id, {
        expectedBaseRef: "main",
        baseRevision: "b".repeat(40),
      }),
    ).rejects.toThrow("Project base reference changed");
    expect(transaction.project.updateMany).not.toHaveBeenCalled();
  });

  it("does not create a base revision for an unknown project", async () => {
    const transaction = {
      project: {
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new ControlService(prisma as never);

    await expect(
      service.updateProjectBaseRevision(draft.projectId, {
        expectedBaseRef: "main",
        baseRevision: "b".repeat(40),
      }),
    ).rejects.toThrow("Project not found");
    expect(transaction.project.updateMany).not.toHaveBeenCalled();
  });
});
