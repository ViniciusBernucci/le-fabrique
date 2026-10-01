import type { EmployeeRole, FactorySettings, SettingsProvider } from "@le-fabrique/contracts";

export const roleLabels: Record<EmployeeRole, string> = {
  PLANNER: "Planner / Tech Lead",
  DEVELOPER: "Developer",
  REVIEWER: "Reviewer",
  QA: "QA",
  DOCUMENTATION: "Documentation",
  SECURITY: "Security",
};

export const providerLabels: Record<SettingsProvider, string> = {
  CODEX: "Codex",
  CLAUDE: "Claude Code",
  ANTIGRAVITY: "Antigravity",
};

export function configurationSummary(settings: FactorySettings) {
  const { configuration } = settings;
  return {
    enabledInstallations: configuration.installations.filter((installation) => installation.enabled)
      .length,
    availableInstallations: configuration.installations.filter(
      (installation) => installation.enabled && installation.state === "AVAILABLE",
    ).length,
    assignedEmployees: configuration.assignments.filter(
      (assignment) => assignment.enabled && assignment.installationId !== null,
    ).length,
    githubConnected: configuration.github.state === "CONNECTED",
  };
}
