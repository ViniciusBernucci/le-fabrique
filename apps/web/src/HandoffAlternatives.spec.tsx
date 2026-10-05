import type { AgentAssignment, ProviderInstallation } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HandoffAlternatives } from "./HandoffAlternatives";
import { pruneAssignmentAlternatives } from "./settings-view-model";

const assignment: AgentAssignment = {
  role: "DEVELOPER",
  enabled: true,
  installationId: "primary",
  model: "selected-model",
  permissionMode: "WORKSPACE_WRITE",
  timeoutMinutes: 30,
  maxAttempts: 2,
};
const installations: ProviderInstallation[] = ["primary", "alternative"].map((id) => ({
  id,
  provider: "CODEX",
  label: id,
  executable: "codex",
  enabled: true,
  state: "AVAILABLE",
  authMode: "SUBSCRIPTION_CLI",
  models: ["selected-model"],
  defaultModel: "selected-model",
}));

it("starts with no selected alternative and offers only configured other accounts", () => {
  const html = renderToStaticMarkup(
    <HandoffAlternatives
      assignment={assignment}
      installations={installations}
      onChange={() => {}}
    />,
  );
  expect(html).toContain("Sem alternativa");
  expect(html).toContain("alternative::selected-model");
  expect(html).not.toContain("primary::selected-model");
  expect(html).toContain("disabled");
  expect(html).toContain("Sem uso extra/API");
});

it("removes stale, duplicated, disabled and unauthorized alternatives after settings changes", () => {
  const alternatives = [
    { installationId: "primary", model: "selected-model" },
    { installationId: "alternative", model: "selected-model" },
    { installationId: "alternative", model: "selected-model" },
    { installationId: "missing", model: "selected-model" },
  ];
  expect(
    pruneAssignmentAlternatives({ ...assignment, alternatives }, installations).alternatives,
  ).toEqual([alternatives[1]]);
  expect(
    pruneAssignmentAlternatives(
      { ...assignment, alternatives },
      installations.map((item) => ({ ...item, enabled: false })),
    ).alternatives,
  ).toEqual([]);
  expect(
    pruneAssignmentAlternatives(
      { ...assignment, installationId: null, model: null, alternatives },
      installations,
    ).alternatives,
  ).toEqual([]);
  expect(
    pruneAssignmentAlternatives(
      { ...assignment, alternatives },
      installations.map((item) => ({ ...item, models: [] })),
    ).alternatives,
  ).toEqual([]);
});
