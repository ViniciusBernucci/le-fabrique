import { expect, it } from "vitest";
import { providerInstallationSchema, updateFactorySettingsSchema } from "./index";

const account = {
  id: "api-test",
  provider: "CODEX",
  label: "OpenAI",
  executable: "codex",
  enabled: true,
  state: "AUTH_REQUIRED",
  authMode: "API_KEY",
  models: ["synthetic-model"],
  defaultModel: "synthetic-model",
};
it("accepts API registrations and preserves CLI registrations", () => {
  expect(providerInstallationSchema.parse(account).authMode).toBe("API_KEY");
  expect(
    providerInstallationSchema.parse({ ...account, authMode: "SUBSCRIPTION_CLI" }).authMode,
  ).toBe("SUBSCRIPTION_CLI");
  expect(
    providerInstallationSchema.safeParse({ ...account, provider: "ANTIGRAVITY" }).success,
  ).toBe(false);
  expect(providerInstallationSchema.safeParse({ ...account, key: "secret" }).success).toBe(false);
});
it("keeps keys out of installation DTOs and bounds separate write input", () => {
  const schema = updateFactorySettingsSchema.shape.apiKeys;
  expect(schema.safeParse([{ installationId: "api-test", key: "synthetic-key" }]).success).toBe(
    true,
  );
  expect(schema.safeParse([{ installationId: "../unsafe", key: "synthetic-key" }]).success).toBe(
    false,
  );
  expect(schema.safeParse([{ installationId: "api-test", key: "" }]).success).toBe(false);
});
