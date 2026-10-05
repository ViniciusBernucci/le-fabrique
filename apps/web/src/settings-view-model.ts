import type {
  AgentAssignment,
  EmployeeRole,
  FactoryConfiguration,
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

/** Preserve local editing while incorporating verified account metadata. */
export function mergeObservedInstallations(
  draft: FactoryConfiguration,
  observed: FactoryConfiguration,
): FactoryConfiguration {
  return {
    ...draft,
    installations: draft.installations.map((item) => {
      const saved = observed.installations.find(
        (candidate) => candidate.id === item.id && candidate.provider === item.provider,
      );
      if (!saved) return item;
      const models = [...new Set([...item.models, ...saved.models])].slice(0, 50);
      return {
        ...item,
        state: saved.state,
        models,
        defaultModel:
          item.defaultModel ??
          (saved.defaultModel && models.includes(saved.defaultModel) ? saved.defaultModel : null),
      };
    }),
  };
}
