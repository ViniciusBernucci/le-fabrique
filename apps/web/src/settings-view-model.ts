import type {
  AgentAssignment,
  EmployeeRole,
  FactoryConfiguration,
  FactorySettings,
  ProviderInstallation,
  ProviderVerification,
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

export function installationProviderLabel(installation: ProviderInstallation): string {
  if (installation.authMode === "API_KEY")
    return installation.provider === "CODEX" ? "OpenAI" : "Claude";
  return providerLabels[installation.provider];
}

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

export function providerVerificationFeedback(result: ProviderVerification): string {
  if (result.status === "PENDING") return "Verificação na fila; aguardando o worker.";
  if (result.status === "RUNNING") return "Verificando a conta e os modelos no worker…";
  if (
    result.message === "Private provider root missing; run providers:setup and restart npm run dev"
  )
    return "O worker está sem o diretório privado das contas. Execute npm run providers:setup e reinicie npm run dev na VPS; depois verifique novamente.";
  if (result.message === "Antigravity requires a private keyring; install gnome-keyring on the VPS")
    return "Falta o keyring privado do Antigravity. Na VPS execute sudo apt-get install -y gnome-keyring; depois verifique novamente.";
  if (result.message === "Build the worker to prepare the Antigravity private keyring launcher")
    return "Prepare o worker na VPS com npm run build -w @le-fabrique/worker e verifique novamente.";
  if (result.providerState === "AUTH_REQUIRED")
    return "Cliente encontrado. É necessário conectar sua assinatura; habilite e salve a conta para iniciar o login.";
  if (result.providerState === "AVAILABLE")
    return result.message === "Subscription authenticated; model catalog unavailable, verify again"
      ? "Conta autenticada, mas não foi possível atualizar o catálogo. Verifique novamente."
      : `Conta autenticada. ${result.observedModels.length} modelo(s) observado(s).`;
  return "A verificação falhou. Confira se npm run providers:setup foi executado e reinicie npm run dev na VPS. Depois tente novamente.";
}
