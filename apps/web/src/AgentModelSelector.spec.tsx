import type { ProviderInstallation } from "@le-fabrique/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AgentModelSelector } from "./AgentModelSelector";

const api: ProviderInstallation = {
  id: "api-test",
  provider: "CODEX",
  label: "Minha OpenAI",
  executable: "codex",
  enabled: true,
  state: "AUTH_REQUIRED",
  authMode: "API_KEY",
  models: ["api-model"],
  defaultModel: "api-model",
};
it("lists only enabled registered accounts and models belonging to the selected IA", () => {
  const html = renderToStaticMarkup(
    createElement(AgentModelSelector, {
      installations: [
        api,
        {
          ...api,
          id: "cli-test",
          authMode: "SUBSCRIPTION_CLI",
          label: "Meu Codex",
          models: ["cli-model"],
        },
        { ...api, id: "disabled", enabled: false, label: "Oculta" },
      ],
      installationId: api.id,
      model: "api-model",
      onChange: () => {},
    }),
  );
  expect(html).toContain("IA do agente");
  expect(html).toContain("Modelo da IA");
  expect(html).toContain("Minha OpenAI · OpenAI · API");
  expect(html).toContain("Meu Codex · Codex · Assinatura CLI");
  expect(html).toContain("api-model");
  expect(html).not.toContain("cli-model");
  expect(html).not.toContain("Oculta");
});
it("shows an empty state without inventing IAs or models", () => {
  const html = renderToStaticMarkup(
    createElement(AgentModelSelector, {
      installations: [],
      installationId: null,
      model: null,
      onChange: () => {},
    }),
  );
  expect(html).toContain("Cadastre e habilite");
  expect(html).toContain("disabled");
  expect(html).not.toContain("Codex");
});
