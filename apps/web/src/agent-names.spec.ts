import type { FactoryConfiguration } from "@le-fabrique/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PresetAgents } from "./PresetAgents";
import { TeamsPanel } from "./TeamsPanel";

const configuration = {
  assignments: [{ role: "DEVELOPER", nickname: "Alex", enabled: false }],
  digitalAgents: [
    {
      id: "designer",
      name: "Designer",
      nickname: "Sofia",
      description: "",
      projectId: null,
      skillIds: [],
      enabled: true,
    },
  ],
  projectSkills: [],
} as unknown as FactoryConfiguration;

it("shows agent names and job titles separately, including accessible preset actions", () => {
  const preset = renderToStaticMarkup(
    createElement(PresetAgents, {
      configuration,
      saving: false,
      onSave: async () => true,
      onConfigure: () => {},
      configuring: false,
    }),
  );
  expect(preset).toContain("<strong>Alex</strong>");
  expect(preset).toContain("Cargo: Developer");
  expect(preset).toContain('aria-label="Ver agente Alex"');
  expect(preset).toContain('aria-label="Ativar agente Alex"');
  const custom = renderToStaticMarkup(
    createElement(TeamsPanel, {
      configuration,
      projects: [],
      saving: false,
      onSave: async () => true,
    }),
  );
  expect(custom).toContain("<strong>Sofia</strong>");
  expect(custom).toContain("Cargo: Designer");
  expect(custom).toContain('aria-label="Editar agente Sofia"');
});

it("keeps legacy job titles visible when the name is absent or cleared", () => {
  for (const nickname of [undefined, ""]) {
    const legacy = {
      ...configuration,
      assignments: configuration.assignments.map((agent) => ({ ...agent, nickname })),
      digitalAgents: configuration.digitalAgents?.map((agent) => ({ ...agent, nickname })),
    };
    expect(
      renderToStaticMarkup(
        createElement(PresetAgents, {
          configuration: legacy,
          saving: false,
          onSave: async () => true,
          onConfigure: () => {},
          configuring: false,
        }),
      ),
    ).toContain("<strong>Developer</strong>");
    expect(
      renderToStaticMarkup(
        createElement(TeamsPanel, {
          configuration: legacy,
          projects: [],
          saving: false,
          onSave: async () => true,
        }),
      ),
    ).toContain("<strong>Designer</strong>");
  }
});
