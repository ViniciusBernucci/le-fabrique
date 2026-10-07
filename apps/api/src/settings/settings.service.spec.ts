import { describe, expect, it, vi } from "vitest";
import { createDefaultFactoryConfiguration } from "./settings.defaults";
import { SettingsService } from "./settings.service";

const now = new Date("2026-10-01T12:00:00.000Z");

describe("SettingsService", () => {
  it("creates conservative defaults without inferred accounts or models", async () => {
    const upsert = vi.fn().mockImplementation(({ create }) => ({
      ...create,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }));
    const prisma = {
      factorySettings: { upsert },
    };
    const service = new SettingsService(prisma as never);

    const result = await service.get();

    expect(result.configuration.installations).toHaveLength(3);
    expect(result.configuration.installations.every((item) => !item.enabled)).toBe(true);
    expect(result.configuration.installations.every((item) => item.models.length === 0)).toBe(true);
    expect(Object.values(result.configuration.financialSafety).every((value) => !value)).toBe(true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it("reads worker defaults without persisting a settings row", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const upsert = vi.fn();
    const service = new SettingsService({ factorySettings: { findUnique, upsert } } as never);
    const observedAt = new Date("2026-10-02T12:00:00.000Z");

    await expect(service.getWorkerConfigurationSnapshot(observedAt)).resolves.toMatchObject({
      version: 0,
      observedAt: observedAt.toISOString(),
      configuration: {
        installations: expect.arrayContaining([
          expect.objectContaining({ enabled: false, models: [], state: "AUTH_REQUIRED" }),
        ]),
        financialSafety: {
          apiEnabled: false,
          extraUsageEnabled: false,
          paidCreditsEnabled: false,
          autoRechargeEnabled: false,
          paidFallbackEnabled: false,
        },
      },
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "global" } });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns only the current persisted runtime configuration version", async () => {
    const configuration = createDefaultFactoryConfiguration();
    const findUnique = vi.fn().mockResolvedValue({ version: 8, configuration });
    const service = new SettingsService({ factorySettings: { findUnique } } as never);
    const observedAt = new Date("2026-10-02T12:00:00.000Z");

    await expect(service.getWorkerConfigurationSnapshot(observedAt)).resolves.toEqual({
      version: 8,
      observedAt: observedAt.toISOString(),
      configuration,
    });
  });

  it("updates atomically with optimistic concurrency", async () => {
    const configuration = createDefaultFactoryConfiguration();
    const record = {
      id: "global",
      version: 2,
      configuration,
      createdAt: now,
      updatedAt: now,
    };
    const transaction = {
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue({ ...record, version: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(record),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new SettingsService(prisma as never);

    await expect(service.update(1, configuration)).resolves.toMatchObject({ version: 2 });
    expect(transaction.factorySettings.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "global", version: 1 } }),
    );
  });

  it("rejects a stale settings version", async () => {
    const transaction = {
      factorySettings: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new SettingsService(prisma as never);

    await expect(service.update(4, createDefaultFactoryConfiguration())).rejects.toThrow(
      "Settings changed",
    );
  });

  it("reserves observed provider and GitHub states for worker evidence", async () => {
    const current = createDefaultFactoryConfiguration();
    const record = {
      id: "global",
      version: 1,
      configuration: current,
      createdAt: now,
      updatedAt: now,
    };
    const transaction = {
      factorySettings: {
        findUnique: vi.fn().mockResolvedValue(record),
        updateMany: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new SettingsService(prisma as never);
    const forgedProvider = structuredClone(current);
    const installation = forgedProvider.installations[0];
    if (!installation) throw new Error("Missing test installation");
    installation.state = "AVAILABLE";

    await expect(service.update(1, forgedProvider)).rejects.toThrow(
      "Provider state is managed by worker evidence",
    );

    const forgedGithub = structuredClone(current);
    forgedGithub.github.state = "CONNECTED";
    await expect(service.update(1, forgedGithub)).rejects.toThrow(
      "GitHub state is managed by worker evidence",
    );
    expect(transaction.factorySettings.updateMany).not.toHaveBeenCalled();
  });
});

it("persists project skills and more than six agents using the existing versioned settings JSON", async () => {
  const projectId = crypto.randomUUID();
  const skillId = crypto.randomUUID();
  const current = createDefaultFactoryConfiguration();
  const configuration = {
    ...current,
    projectSkills: [
      {
        id: skillId,
        projectId,
        name: "Skill de revisão",
        description: "",
        instructions: "Verifique a UI.",
      },
    ],
    digitalAgents: Array.from({ length: 12 }, (_, index) => ({
      id: crypto.randomUUID(),
      projectId,
      name: `Agente ${index}`,
      description: "",
      instructions: "",
      installationId: null,
      model: null,
      skillIds: [skillId],
      enabled: true,
    })),
  };
  const record = { id: "global", version: 2, configuration, createdAt: now, updatedAt: now };
  const transaction = {
    project: { findMany: vi.fn().mockResolvedValue([{ id: projectId }]) },
    factorySettings: {
      findUnique: vi.fn().mockResolvedValue({ ...record, configuration: current, version: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(record),
    },
  };
  const service = new SettingsService({
    $transaction: vi.fn((callback) => callback(transaction)),
  } as never);
  const result = await service.update(1, configuration);
  expect(result.configuration.digitalAgents).toHaveLength(12);
  expect(result.configuration.projectSkills?.[0]?.projectId).toBe(projectId);
  expect(transaction.project.findMany).toHaveBeenCalledWith({
    where: { id: { in: [projectId] } },
    select: { id: true },
  });
  expect(transaction.factorySettings.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ configuration }) }),
  );
});

it("rejects project skills or agents referencing a nonexistent project before writing", async () => {
  const configuration = createDefaultFactoryConfiguration();
  configuration.projectSkills = [
    {
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      name: "Skill",
      description: "",
      instructions: "Review",
    },
  ];
  const transaction = {
    project: { findMany: vi.fn().mockResolvedValue([]) },
    factorySettings: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ version: 1, configuration: createDefaultFactoryConfiguration() }),
      updateMany: vi.fn(),
    },
  };
  const service = new SettingsService({
    $transaction: vi.fn((callback) => callback(transaction)),
  } as never);
  await expect(service.update(1, configuration)).rejects.toThrow("project does not exist");
  expect(transaction.factorySettings.updateMany).not.toHaveBeenCalled();
});
