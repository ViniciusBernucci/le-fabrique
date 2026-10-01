import { describe, expect, it, vi } from "vitest";
import { createDefaultFactoryConfiguration } from "./settings.defaults";
import { SettingsService } from "./settings.service";

const now = new Date("2026-10-01T12:00:00.000Z");

describe("SettingsService", () => {
  it("creates conservative defaults without inferred accounts or models", async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({
      ...data,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }));
    const prisma = {
      factorySettings: { findUnique: vi.fn().mockResolvedValue(null), create },
    };
    const service = new SettingsService(prisma as never);

    const result = await service.get();

    expect(result.configuration.installations).toHaveLength(3);
    expect(result.configuration.installations.every((item) => !item.enabled)).toBe(true);
    expect(result.configuration.installations.every((item) => item.models.length === 0)).toBe(true);
    expect(Object.values(result.configuration.financialSafety).every((value) => !value)).toBe(true);
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
      factorySettings: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(transaction)) };
    const service = new SettingsService(prisma as never);

    await expect(service.update(4, createDefaultFactoryConfiguration())).rejects.toThrow(
      "Settings changed",
    );
  });
});
