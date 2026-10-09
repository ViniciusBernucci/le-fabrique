import { afterEach, expect, it, vi } from "vitest";
import { ProviderOnboardingService } from "./provider-onboarding.service";
import { ProviderVerificationService } from "./provider-verification.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";
import { SettingsService } from "./settings.service";

const account = {
  id: "api-test",
  provider: "CODEX" as const,
  label: "OpenAI",
  executable: "codex",
  enabled: true,
  state: "AUTH_REQUIRED" as const,
  authMode: "API_KEY" as const,
  models: ["synthetic-model"],
  defaultModel: "synthetic-model",
};
function fixture(existingApi = false) {
  const previous = createDefaultFactoryConfiguration();
  if (existingApi) previous.installations.push(account);
  const date = new Date("2026-10-09T10:00:00Z");
  const record = {
    id: "global",
    version: 1,
    configuration: previous,
    createdAt: date,
    updatedAt: date,
  };
  const transaction = {
    factorySettings: {
      findUnique: vi.fn(async () => record),
      updateMany: vi.fn(async ({ data }) => {
        record.configuration = data.configuration;
        record.version++;
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => record),
    },
    providerApiCredential: { upsert: vi.fn(), deleteMany: vi.fn() },
    providerOnboardingSession: { updateMany: vi.fn() },
  };
  const prisma = {
    ...transaction,
    $transaction: async (fn: (t: unknown) => unknown) => fn(transaction),
  };
  return { transaction, service: new SettingsService(prisma as never), prisma, previous };
}
afterEach(() => vi.unstubAllEnvs());
it("saves an encrypted key separately from public configuration and readback", async () => {
  vi.stubEnv("PROVIDER_API_KEY_ENCRYPTION_KEY", "ab".repeat(32));
  const { service, previous, transaction } = fixture();
  const result = await service.update(
    1,
    { ...previous, installations: [...previous.installations, account] },
    [{ installationId: account.id, key: "synthetic-secret" }],
  );
  expect(transaction.providerApiCredential.upsert).toHaveBeenCalledOnce();
  const data = transaction.providerApiCredential.upsert.mock.calls[0][0];
  expect(data.create.encryptedKey).toMatch(/^v1:/);
  expect(JSON.stringify(data)).not.toContain("synthetic-secret");
  expect(JSON.stringify(result)).not.toContain("synthetic-secret");
  expect(result.version).toBe(2);
});
it("rejects a new API account without a key and a key targeted at CLI", async () => {
  const { service, previous, transaction } = fixture();
  await expect(
    service.update(1, { ...previous, installations: [...previous.installations, account] }),
  ).rejects.toThrow("requires a key");
  await expect(
    service.update(1, previous, [
      { installationId: previous.installations[0].id, key: "synthetic-secret" },
    ]),
  ).rejects.toThrow("requires a registered API");
  expect(transaction.factorySettings.updateMany).not.toHaveBeenCalled();
});
it("preserves an existing key on ordinary edits and removes it when the account is removed", async () => {
  const { service, previous, transaction } = fixture(true);
  await service.update(1, {
    ...previous,
    installations: previous.installations.map((item) => ({ ...item, label: "Edited" })),
  });
  expect(transaction.providerApiCredential.upsert).not.toHaveBeenCalled();
  await service.update(2, {
    ...previous,
    installations: previous.installations.filter((item) => item.id !== account.id),
  });
  expect(transaction.providerApiCredential.deleteMany).toHaveBeenLastCalledWith({
    where: { installationId: { notIn: [] } },
  });
});
it("does not write keys after a stale version or silently convert authentication modes", async () => {
  const { service, previous, transaction } = fixture(true);
  await expect(
    service.update(2, previous, [{ installationId: account.id, key: "synthetic-secret" }]),
  ).rejects.toThrow("Settings changed");
  await expect(
    service.update(1, {
      ...previous,
      installations: previous.installations.map((item) =>
        item.id === account.id ? { ...item, authMode: "SUBSCRIPTION_CLI" } : item,
      ),
    }),
  ).rejects.toThrow("authentication mode");
  expect(transaction.providerApiCredential.upsert).not.toHaveBeenCalled();
});
it("rejects API accounts before enqueuing CLI login or verification", async () => {
  const { prisma } = fixture(true);
  await expect(
    new ProviderOnboardingService(prisma as never, {} as never).request(account.id),
  ).rejects.toThrow("require a subscription installation");
  await expect(
    new ProviderVerificationService(prisma as never).request(account.id),
  ).rejects.toThrow("require a subscription installation");
});
