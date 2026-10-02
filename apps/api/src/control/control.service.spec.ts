import { describe, expect, it, vi } from "vitest";
import { ControlService } from "./control.service";

const now = new Date("2026-09-30T12:00:00.000Z");
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
  project: { baseRef: "a".repeat(40) },
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
          payload: expect.objectContaining({ baseRevision: "a".repeat(40) }),
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
    const unresolved = { ...draft, project: { baseRef: "main" } };
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
