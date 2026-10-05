import { factoryConfigurationSchema } from "@le-fabrique/contracts";
import { describe, expect, it, vi } from "vitest";
import { ProviderVerificationService } from "./provider-verification.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";

describe("verified model publication", () => {
  for (const state of ["AVAILABLE", "ERROR"] as const) {
    it(`publishes models only for ${state} results`, async () => {
      const configuration = createDefaultFactoryConfiguration();
      const installation = configuration.installations[0];
      if (!installation) throw new Error("Fixture missing");
      installation.models = ["existing-model"];
      installation.defaultModel = null;
      const workerId = "11111111-1111-4111-8111-111111111111";
      const id = "22222222-2222-4222-8222-222222222222";
      const record = {
        id,
        workerId,
        installationId: installation.id,
        provider: "CODEX",
        status: "RUNNING",
        cliVersion: null,
        providerState: null,
        observedModels: [],
        message: null,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
      };
      const transaction = {
        factorySettings: {
          findUnique: vi.fn().mockResolvedValue({ configuration }),
          update: vi.fn().mockResolvedValue({}),
        },
        providerVerification: {
          findUnique: vi.fn().mockResolvedValue(record),
          update: vi.fn(async ({ data }) => ({ ...record, ...data })),
        },
      };
      const service = new ProviderVerificationService({
        $transaction: async (callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
      } as never);
      await service.complete(id, {
        workerId,
        status: "COMPLETED",
        providerState: state,
        cliVersion: "codex-cli 0.159.2",
        observedModels: ["existing-model", "discovered-model"],
        message: "Verified",
      });
      const saved = factoryConfigurationSchema.parse(
        transaction.factorySettings.update.mock.calls[0]?.[0].data.configuration,
      );
      expect(saved.installations[0]?.models).toEqual(
        state === "AVAILABLE" ? ["existing-model", "discovered-model"] : ["existing-model"],
      );
      expect(saved.installations[0]?.defaultModel).toBe(
        state === "AVAILABLE" ? "existing-model" : null,
      );
      expect(transaction.factorySettings.update.mock.calls[0]?.[0].data.version).toEqual({
        increment: 1,
      });
    });
  }
});
