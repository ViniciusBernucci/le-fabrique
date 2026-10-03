import type {
  AgentAssignment,
  EmployeeRole,
  FactorySettings,
  ProviderInstallation,
  SettingsProvider,
} from "@le-fabrique/contracts";

export function pruneAssignmentAlternatives(
  assignment: AgentAssignment,
  installations: ProviderInstallation[],
): AgentAssignment {
  const used = new Set(assignment.installationId ? [assignment.installationId] : []);
  return {
    ...assignment,
    alternatives: assignment.installationId
      ? (assignment.alternatives ?? []).filter((alternative) => {
          const installation = installations.find((item) => item.id === alternative.installationId);
          if (
            used.has(alternative.installationId) ||
            !installation?.enabled ||
            !installation.models.includes(alternative.model)
          )
            return false;
          used.add(alternative.installationId);
          return true;
        })
      : [],
  };
}

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
