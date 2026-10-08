import type {
  AgentAssignment,
  FactoryConfiguration,
  FactorySettings,
  GithubOnboardingChallenge,
  GithubOnboardingSession,
  GithubPullRequest,
  GithubRepositoryVerification,
  GithubVerification,
  Project,
  ProviderInstallation,
  ProviderOnboardingChallenge,
  ProviderOnboardingSession,
  ProviderVerification,
} from "@le-fabrique/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { type CodexLoginTab, openCodexLoginTab } from "./codex-login-tab";
import {
  approveGithubPullRequest,
  cancelGithubPullRequest,
  getFactorySettings,
  getGithubOnboardingChallenge,
  getProviderOnboardingChallenge,
  listGithubOnboardingSessions,
  listGithubPullRequests,
  listGithubRepositoryVerifications,
  listGithubVerifications,
  listProviderOnboardingSessions,
  listProviderVerifications,
  prepareGithubPullRequest,
  requestGithubOnboarding,
  requestGithubRepositoryVerification,
  requestGithubVerification,
  requestProviderOnboarding,
  requestProviderVerification,
  submitProviderAuthorizationCode,
  updateFactorySettings,
} from "./control-api";
import { HandoffAlternatives } from "./HandoffAlternatives";
import { PresetAgents } from "./PresetAgents";
import { SettingsModal } from "./SettingsModal";
import {
  configurationSummary,
  mergeObservedInstallations,
  providerLabels,
  providerVerificationFeedback,
  pruneAssignmentAlternatives,
  roleLabels,
} from "./settings-view-model";
import { TeamsPanel } from "./TeamsPanel";
import { pruneTeamAgentInstallations } from "./teams-view-model";

type SettingsPanelProps = {
  token: string;
  onMessage: (message: string) => void;
  projects?: Project[];
  activeProjectId?: string;
};

function statusLabel(state: string) {
  return state.replaceAll("_", " ");
}

export function SettingsPanel({
  token,
  onMessage,
  projects = [],
  activeProjectId,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"accounts" | "integrations" | "teams">("accounts");
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [draft, setDraft] = useState<FactoryConfiguration | null>(null);
  const loginTabs = useRef(new Map<string, CodexLoginTab>());
  const [connectingInstallation, setConnectingInstallation] = useState<string | null>(null);
  const [authorizationCodes, setAuthorizationCodes] = useState<Record<string, string>>({});
  const [sendingCode, setSendingCode] = useState<string | null>(null);
  const [submittedCodes, setSubmittedCodes] = useState<Record<string, boolean>>({});
  const [loginRefreshError, setLoginRefreshError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const initiatedLogins = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);
  const [editingInstallation, setEditingInstallation] = useState<ProviderInstallation | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<AgentAssignment | null>(null);
  const [editingGithub, setEditingGithub] = useState<FactoryConfiguration["github"] | null>(null);

  const [requestingVerification, setRequestingVerification] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<ProviderVerification[]>([]);
  const [githubVerifications, setGithubVerifications] = useState<GithubVerification[]>([]);
  const [githubOnboardingSessions, setGithubOnboardingSessions] = useState<
    GithubOnboardingSession[]
  >([]);
  const [githubRepositoryVerifications, setGithubRepositoryVerifications] = useState<
    GithubRepositoryVerification[]
  >([]);
  const [githubPullRequests, setGithubPullRequests] = useState<GithubPullRequest[]>([]);
  const [pullRequestHead, setPullRequestHead] = useState("");
  const [pullRequestTitle, setPullRequestTitle] = useState("");
  const [pullRequestBody, setPullRequestBody] = useState("");
  const [pullRequestDraft, setPullRequestDraft] = useState(true);
  const [githubOnboardingChallenges, setGithubOnboardingChallenges] = useState<
    Record<string, GithubOnboardingChallenge>
  >({});
  const [onboardingSessions, setOnboardingSessions] = useState<ProviderOnboardingSession[]>([]);
  const [onboardingChallenges, setOnboardingChallenges] = useState<
    Record<string, ProviderOnboardingChallenge>
  >({});
  const hasActiveOnboarding = onboardingSessions.some((item) =>
    ["PENDING", "RUNNING", "AWAITING_USER"].includes(item.status),
  );
  const hasActiveGithubOnboarding = githubOnboardingSessions.some((item) =>
    ["PENDING", "RUNNING", "AWAITING_USER"].includes(item.status),
  );

  useEffect(() => {
    Promise.all([
      getFactorySettings(token),
      listProviderVerifications(token),
      listProviderOnboardingSessions(token),
      listGithubVerifications(token),
      listGithubOnboardingSessions(token),
      listGithubRepositoryVerifications(token),
      listGithubPullRequests(token),
    ])
      .then(
        ([
          data,
          history,
          sessions,
          githubHistory,
          githubSessions,
          repositoryHistory,
          pullRequests,
        ]) => {
          setSettings(data);
          setDraft(structuredClone(data.configuration));
          setVerifications(history);
          setOnboardingSessions(sessions);
          setGithubVerifications(githubHistory);
          setGithubOnboardingSessions(githubSessions);
          setGithubRepositoryVerifications(repositoryHistory);
          setGithubPullRequests(pullRequests);
        },
      )
      .catch(() => onMessage("Falha ao carregar as configurações."));
  }, [onMessage, token]);

  useEffect(() => {
    if (!hasActiveOnboarding) return;
    const refresh = async () => {
      const [data, sessions] = await Promise.all([
        getFactorySettings(token),
        listProviderOnboardingSessions(token),
      ]);
      setSettings(data);
      setDraft((current) => {
        if (!current) return current;
        return mergeObservedInstallations(current, data.configuration);
      });
      setOnboardingSessions(sessions);
      const activeIds = new Set(
        sessions
          .filter((item) => ["PENDING", "RUNNING", "AWAITING_USER"].includes(item.status))
          .map((item) => item.id),
      );
      setAuthorizationCodes((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))),
      );
      setLoginRefreshError(null);
      for (const session of sessions) {
        if (
          session.status === "COMPLETED" &&
          session.providerState === "AVAILABLE" &&
          initiatedLogins.current.delete(session.id)
        ) {
          const verification = await requestProviderVerification(token, session.installationId);
          setVerifications((current) => [
            verification,
            ...current.filter((item) => item.id !== verification.id),
          ]);
        }
      }
      const challenges = await Promise.all(
        sessions
          .filter((item) => ["RUNNING", "AWAITING_USER"].includes(item.status))
          .map(async (item) => {
            try {
              return [item.id, await getProviderOnboardingChallenge(token, item.id)] as const;
            } catch {
              return null;
            }
          }),
      );
      for (const entry of challenges) {
        if (!entry) continue;
        loginTabs.current.get(entry[0])?.authorize(entry[1].verificationUri);
      }
      for (const session of sessions) {
        if (["COMPLETED", "FAILED", "EXPIRED"].includes(session.status)) {
          loginTabs.current.get(session.id)?.closeWaiting();
          loginTabs.current.delete(session.id);
        }
      }
      setOnboardingChallenges(Object.fromEntries(challenges.filter((item) => item !== null)));
    };
    void refresh().catch(() =>
      setLoginRefreshError(
        "Falha ao consultar o login. Confira a conexão com a API; sua autorização ainda não foi confirmada.",
      ),
    );
    const timer = setInterval(() => {
      void refresh().catch(() =>
        setLoginRefreshError(
          "Falha ao consultar o login. Confira a conexão com a API; sua autorização ainda não foi confirmada.",
        ),
      );
    }, 2_000);
    return () => clearInterval(timer);
  }, [hasActiveOnboarding, token]);

  useEffect(() => {
    if (!verifications.some((item) => ["PENDING", "RUNNING"].includes(item.status))) return;
    const timer = setInterval(() => {
      void Promise.all([getFactorySettings(token), listProviderVerifications(token)])
        .then(([data, history]) => {
          setSettings(data);
          setEditingInstallation((current) =>
            current
              ? (mergeObservedInstallations(
                  { ...data.configuration, installations: [current] },
                  data.configuration,
                ).installations[0] ?? current)
              : null,
          );
          setDraft((current) => {
            if (!current) return current;
            return mergeObservedInstallations(current, data.configuration);
          });
          setVerifications(history);
          setVerificationError(null);
        })
        .catch(() =>
          setVerificationError(
            "Falha ao consultar o resultado. Confira a conexão com a API; a verificação solicitada continua no worker.",
          ),
        );
    }, 3_000);
    return () => clearInterval(timer);
  }, [token, verifications]);

  useEffect(() => {
    if (!githubVerifications.some((item) => ["PENDING", "RUNNING"].includes(item.status))) return;
    const timer = setInterval(() => {
      void Promise.all([getFactorySettings(token), listGithubVerifications(token)]).then(
        ([data, history]) => {
          setSettings(data);
          setDraft((current) =>
            current
              ? {
                  ...current,
                  github: { ...current.github, state: data.configuration.github.state },
                }
              : current,
          );
          setGithubVerifications(history);
        },
      );
    }, 3_000);
    return () => clearInterval(timer);
  }, [githubVerifications, token]);

  useEffect(() => {
    if (!hasActiveGithubOnboarding) return;
    const refresh = async () => {
      const [data, sessions] = await Promise.all([
        getFactorySettings(token),
        listGithubOnboardingSessions(token),
      ]);
      setSettings(data);
      setDraft((current) =>
        current
          ? { ...current, github: { ...current.github, state: data.configuration.github.state } }
          : current,
      );
      setGithubOnboardingSessions(sessions);
      const challenges = await Promise.all(
        sessions
          .filter((item) => ["RUNNING", "AWAITING_USER"].includes(item.status))
          .map(async (item) => {
            try {
              return [item.id, await getGithubOnboardingChallenge(token, item.id)] as const;
            } catch {
              return null;
            }
          }),
      );
      setGithubOnboardingChallenges(Object.fromEntries(challenges.filter((item) => item !== null)));
    };
    void refresh().catch(() => onMessage("Falha ao atualizar o login GitHub."));
    const timer = setInterval(() => {
      void refresh().catch(() => onMessage("Falha ao atualizar o login GitHub."));
    }, 2_000);
    return () => clearInterval(timer);
  }, [hasActiveGithubOnboarding, onMessage, token]);

  useEffect(() => {
    if (
      !githubRepositoryVerifications.some((item) => ["PENDING", "RUNNING"].includes(item.status))
    ) {
      return;
    }
    const timer = setInterval(() => {
      void listGithubRepositoryVerifications(token).then(setGithubRepositoryVerifications);
    }, 3_000);
    return () => clearInterval(timer);
  }, [githubRepositoryVerifications, token]);

  useEffect(() => {
    if (!githubPullRequests.some((item) => ["APPROVED", "RUNNING"].includes(item.status))) return;
    const timer = setInterval(() => {
      void listGithubPullRequests(token).then(setGithubPullRequests);
    }, 3_000);
    return () => clearInterval(timer);
  }, [githubPullRequests, token]);

  const summary = useMemo(() => (settings ? configurationSummary(settings) : null), [settings]);
  const latestGithubOnboarding = githubOnboardingSessions[0];
  const currentGithubChallenge = latestGithubOnboarding
    ? githubOnboardingChallenges[latestGithubOnboarding.id]
    : undefined;
  const latestGithubPullRequest = githubPullRequests[0];

  function updateInstallation(patch: Partial<ProviderInstallation>) {
    setEditingInstallation((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveInstallation() {
    if (!draft || !editingInstallation) return;
    const updated = {
      ...editingInstallation,
      state:
        settings?.configuration.installations.find(
          (item) =>
            item.id === editingInstallation.id && item.provider === editingInstallation.provider,
        )?.state ?? editingInstallation.state,
    };
    const installations = draft.installations.some((item) => item.id === updated.id)
      ? draft.installations.map((item) => (item.id === updated.id ? updated : item))
      : [...draft.installations, updated];
    const assignments = draft.assignments.map((assignment) =>
      pruneAssignmentAlternatives(
        assignment.installationId === updated.id &&
          (!updated.enabled ||
            assignment.model === null ||
            !updated.models.includes(assignment.model))
          ? { ...assignment, enabled: false, installationId: null, model: null }
          : assignment,
        installations,
      ),
    );
    if (
      await save({
        ...draft,
        installations,
        assignments,
        digitalAgents: pruneTeamAgentInstallations(draft.digitalAgents, installations),
      })
    )
      setEditingInstallation(null);
  }

  function updateAssignment(patch: Partial<AgentAssignment>) {
    setEditingAssignment((current) =>
      current && draft
        ? pruneAssignmentAlternatives({ ...current, ...patch }, draft.installations)
        : current,
    );
  }

  async function saveAssignment() {
    if (!draft || !editingAssignment) return;
    const assignments = draft.assignments.map((assignment) =>
      assignment.role === editingAssignment.role ? editingAssignment : assignment,
    );
    if (await save({ ...draft, assignments })) setEditingAssignment(null);
  }

  async function saveGithubConfiguration() {
    if (!draft || !editingGithub) return;
    if (await save({ ...draft, github: editingGithub })) setEditingGithub(null);
  }

  function addInstallation() {
    if (!draft || draft.installations.length >= 20) return;
    setEditingInstallation({
      id: `account-${crypto.randomUUID()}`,
      provider: "CODEX",
      label: "Nova conta Codex",
      executable: "codex",
      enabled: false,
      state: "AUTH_REQUIRED",
      authMode: "SUBSCRIPTION_CLI",
      models: [],
      defaultModel: null,
    });
  }

  function removeInstallation(installationId: string) {
    setEditingInstallation(null);
    onMessage("Conta removida da lista; clique em Salvar alterações para confirmar.");
    setDraft((current) =>
      current
        ? {
            ...current,
            installations: current.installations.filter((item) => item.id !== installationId),
            digitalAgents: pruneTeamAgentInstallations(
              current.digitalAgents,
              current.installations.filter((item) => item.id !== installationId),
            ),
            assignments: current.assignments.map((assignment) =>
              assignment.installationId === installationId
                ? {
                    ...assignment,
                    enabled: false,
                    installationId: null,
                    model: null,
                    alternatives: [],
                  }
                : pruneAssignmentAlternatives(
                    assignment,
                    current.installations.filter((item) => item.id !== installationId),
                  ),
            ),
          }
        : current,
    );
  }

  async function save(configuration = draft) {
    if (!settings || !configuration) return false;
    setSaving(true);
    try {
      const updated = await updateFactorySettings(token, {
        expectedVersion: settings.version,
        configuration,
      });
      setSettings(updated);
      setDraft(structuredClone(updated.configuration));
      onMessage(`Configurações salvas na versão ${updated.version}.`);
      return true;
    } catch {
      onMessage("Configuração inválida ou desatualizada; revise os campos e recarregue.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function verify(installationId: string) {
    setRequestingVerification(installationId);
    setVerificationError(null);
    try {
      const verification = await requestProviderVerification(token, installationId);
      setVerifications((current) => [
        verification,
        ...current.filter((item) => item.id !== verification.id),
      ]);
      onMessage("Verificação enviada ao worker; nenhum prompt será executado.");
    } catch {
      const message =
        "Não foi possível solicitar a verificação. Confira a conexão com a API e tente novamente.";
      setVerificationError(message);
      onMessage(message);
    } finally {
      setRequestingVerification(null);
    }
  }

  async function connect(installationId: string) {
    const provider =
      settings?.configuration.installations.find((item) => item.id === installationId)?.provider ??
      "CODEX";
    const tab = openCodexLoginTab(provider);
    setConnectingInstallation(installationId);
    setLoginError(null);
    try {
      const session = await requestProviderOnboarding(token, installationId);
      initiatedLogins.current.add(session.id);
      loginTabs.current.get(session.id)?.closeWaiting();
      loginTabs.current.set(session.id, tab);
      setOnboardingSessions((current) => [
        session,
        ...current.filter((item) => item.id !== session.id),
      ]);
      onMessage("Login oficial iniciado; aguarde o código temporário.");
    } catch {
      tab.closeWaiting();
      const message =
        "Não foi possível iniciar o login desta instalação. Confira se a conta está habilitada e salva e tente novamente.";
      setLoginError(message);
      onMessage(message);
    } finally {
      setConnectingInstallation(null);
    }
  }

  async function sendAuthorizationCode(sessionId: string) {
    setSendingCode(sessionId);
    setLoginError(null);
    try {
      await submitProviderAuthorizationCode(token, sessionId, authorizationCodes[sessionId] ?? "");
      setAuthorizationCodes((current) => ({ ...current, [sessionId]: "" }));
      setSubmittedCodes((current) => ({ ...current, [sessionId]: true }));
    } catch {
      setLoginError(
        "Não foi possível enviar o código. Confira o código e se a sessão ainda está ativa.",
      );
    } finally {
      setSendingCode(null);
    }
  }

  async function verifyGithub() {
    try {
      const verification = await requestGithubVerification(token);
      setGithubVerifications((current) => [
        verification,
        ...current.filter((item) => item.id !== verification.id),
      ]);
      onMessage("Verificação GitHub enviada ao worker; nenhum token será lido pelo painel.");
    } catch {
      onMessage("Não foi possível solicitar a verificação GitHub.");
    }
  }

  async function connectGithub() {
    try {
      const session = await requestGithubOnboarding(token);
      setGithubOnboardingSessions((current) => [
        session,
        ...current.filter((item) => item.id !== session.id),
      ]);
      onMessage("Login oficial GitHub iniciado; aguarde o código temporário.");
    } catch {
      onMessage("Não foi possível iniciar o login GitHub.");
    }
  }

  async function verifyGithubRepository() {
    try {
      const verification = await requestGithubRepositoryVerification(token);
      setGithubRepositoryVerifications((current) => [
        verification,
        ...current.filter((item) => item.id !== verification.id),
      ]);
      onMessage("Verificação somente-leitura do repositório enviada ao worker.");
    } catch {
      onMessage("Não foi possível verificar o repositório GitHub salvo.");
    }
  }

  async function preparePullRequest() {
    try {
      const request = await prepareGithubPullRequest(token, {
        headBranch: pullRequestHead,
        title: pullRequestTitle,
        body: pullRequestBody,
        draft: pullRequestDraft,
      });
      setGithubPullRequests((current) => [
        request,
        ...current.filter((item) => item.id !== request.id),
      ]);
      onMessage("PR preparado. Revise o payload e aprove em um segundo ato.");
    } catch {
      onMessage("Não foi possível preparar o PR; confirme configuração e leitura do repositório.");
    }
  }

  async function approvePullRequest(request: GithubPullRequest) {
    if (!window.confirm(`Criar PR ${request.headBranch} → ${request.baseBranch}?`)) return;
    try {
      const updated = await approveGithubPullRequest(token, request);
      setGithubPullRequests((current) => [
        updated,
        ...current.filter((item) => item.id !== updated.id),
      ]);
      onMessage("PR aprovado; o worker verificará escrita antes de criar.");
    } catch {
      onMessage("A aprovação ficou obsoleta ou o alvo deixou de ser elegível.");
    }
  }

  async function cancelPullRequest(request: GithubPullRequest) {
    try {
      const updated = await cancelGithubPullRequest(token, request);
      setGithubPullRequests((current) => [
        updated,
        ...current.filter((item) => item.id !== updated.id),
      ]);
      onMessage("Preparação de PR cancelada sem side effect.");
    } catch {
      onMessage("Não foi possível cancelar esta preparação.");
    }
  }

  if (!draft || !settings || !summary) return <section className="panel">Carregando…</section>;

  return (
    <div className="settings-stack">
      <section className="settings-hero">
        <div>
          <p className="eyebrow">CENTRO DE CONFIGURAÇÕES</p>
          <h2>Equipe, contas e integrações</h2>
          <p className="muted">
            Defina quem usa cada cliente e modelo. Autenticações permanecem no runtime da VPS.
          </p>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </section>

      <section className="metric-grid" aria-label="Resumo da configuração">
        <article>
          <strong>{summary.enabledInstallations}</strong>
          <span>clientes habilitados</span>
        </article>
        <article>
          <strong>{summary.availableInstallations}</strong>
          <span>clientes disponíveis</span>
        </article>
        <article>
          <strong>{summary.assignedEmployees}</strong>
          <span>funções atribuídas</span>
        </article>
        <article>
          <strong>{summary.githubConnected ? "ON" : "OFF"}</strong>
          <span>GitHub conectado</span>
        </article>
      </section>

      <div className="settings-tabs" role="tablist" aria-label="Categorias de configurações">
        {(
          [
            ["accounts", "Contas"],
            ["integrations", "Integrações IA"],
            ["teams", "Equipes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`settings-tab-${id}`}
            aria-controls={`settings-panel-${id}`}
            aria-selected={activeTab === id}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={(event) => {
              const ids = ["accounts", "integrations", "teams"] as const;
              const index = ids.indexOf(id);
              const next =
                event.key === "ArrowRight"
                  ? ids[(index + 1) % 3]
                  : event.key === "ArrowLeft"
                    ? ids[(index + 2) % 3]
                    : event.key === "Home"
                      ? ids[0]
                      : event.key === "End"
                        ? ids[2]
                        : null;
              if (next) {
                event.preventDefault();
                setActiveTab(next);
                document.getElementById(`settings-tab-${next}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id="settings-panel-accounts"
        role="tabpanel"
        aria-labelledby="settings-tab-accounts"
        hidden={activeTab !== "accounts"}
        className="settings-tab-panel"
      >
        <section className="panel settings-section">
          <div className="section-heading">
            <div>
              <p className="section-index">01</p>
              <h2>Contas de IA</h2>
            </div>
            <p>
              Clientes oficiais por assinatura. Modelos só devem ser incluídos após observação real.
            </p>
          </div>
          <button
            className="secondary-action"
            type="button"
            onClick={addInstallation}
            disabled={draft.installations.length >= 20}
          >
            + Adicionar conta
          </button>
          <div className="account-list">
            {draft.installations.length === 0 && (
              <p className="muted">Nenhuma conta cadastrada. Adicione uma conta para começar.</p>
            )}
            {draft.installations.map((installation) => (
              <button
                type="button"
                className="account-list-item"
                key={installation.id}
                onClick={() => setEditingInstallation(structuredClone(installation))}
                aria-label={`Configurar ${installation.label}`}
              >
                <span
                  className={`provider-mark provider-mark--${installation.provider.toLowerCase()}`}
                >
                  {providerLabels[installation.provider].slice(0, 1)}
                </span>
                <span className="account-list-name">
                  <strong>{installation.label}</strong>
                  <span className="account-list-detail">
                    {providerLabels[installation.provider]} ·{" "}
                    {installation.enabled ? "Habilitada" : "Desabilitada"}
                  </span>
                </span>
                <span className={`status status--${installation.state.toLowerCase()}`}>
                  {statusLabel(installation.state)}
                </span>
                <span className="account-list-edit">Configurar →</span>
              </button>
            ))}
          </div>
          {editingInstallation &&
            (() => {
              const installation = {
                ...editingInstallation,
                state:
                  settings.configuration.installations.find(
                    (item) =>
                      item.id === editingInstallation.id &&
                      item.provider === editingInstallation.provider,
                  )?.state ?? editingInstallation.state,
              };
              return (
                <SettingsModal
                  title="Configurar conta"
                  saving={saving}
                  onClose={() => setEditingInstallation(null)}
                  onSave={() => void saveInstallation()}
                >
                  {requestingVerification === installation.id ? (
                    <p role="status">Enviando verificação à API…</p>
                  ) : null}
                  {verificationError ? <p role="alert">{verificationError}</p> : null}
                  {(() => {
                    const latest = verifications.find(
                      (item) => item.installationId === installation.id,
                    );
                    return latest ? (
                      <div className="verification-line" role="status" aria-live="polite">
                        <p>{providerVerificationFeedback(latest)}</p>
                        {latest.cliVersion ? <p>Cliente: {latest.cliVersion}</p> : null}
                      </div>
                    ) : null;
                  })()}
                  {connectingInstallation === installation.id ? (
                    <p role="status">Iniciando login oficial e aguardando instruções…</p>
                  ) : null}
                  {loginError ? <p role="alert">{loginError}</p> : null}
                  {loginRefreshError ? <p role="alert">{loginRefreshError}</p> : null}
                  {(() => {
                    const session = onboardingSessions.find(
                      (item) => item.installationId === installation.id,
                    );
                    const challenge = session ? onboardingChallenges[session.id] : undefined;
                    if (!session) return null;
                    return (
                      <div className="onboarding-status">
                        <p>
                          Login: <strong>{statusLabel(session.status)}</strong>
                        </p>
                        {session.status === "PENDING" || session.status === "RUNNING" ? (
                          <p>
                            Aguardando URL e código do cliente oficial. O login ainda não foi
                            confirmado.
                          </p>
                        ) : null}
                        {session.status === "COMPLETED" && session.providerState === "AVAILABLE" ? (
                          <p>Conta conectada e confirmada pelo cliente oficial.</p>
                        ) : null}
                        {session.status === "EXPIRED" ? (
                          <p>O código expirou. Inicie novamente o login.</p>
                        ) : null}
                        {session.status === "FAILED" ? (
                          <p>Não foi possível confirmar o login. Tente novamente.</p>
                        ) : null}
                        {challenge ? (
                          <div className="onboarding-challenge">
                            <span>
                              {challenge.flow === "AUTHORIZATION_CODE"
                                ? "Abra o site oficial, autorize sua conta e devolva o código exibido no navegador:"
                                : "Abra o site oficial e informe o código temporário:"}
                            </span>
                            <a
                              href={challenge.verificationUri}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              Abrir login oficial em nova aba
                            </a>
                            {challenge.userCode ? <code>{challenge.userCode}</code> : null}
                            {challenge.flow === "AUTHORIZATION_CODE" ? (
                              submittedCodes[session.id] ? (
                                <p role="status">
                                  Código enviado ao cliente oficial. Aguarde a confirmação da conta
                                  conectada.
                                </p>
                              ) : (
                                <div>
                                  <label>
                                    Código devolvido pelo provedor
                                    <input
                                      type="password"
                                      autoComplete="off"
                                      value={authorizationCodes[session.id] ?? ""}
                                      onChange={(event) =>
                                        setAuthorizationCodes((current) => ({
                                          ...current,
                                          [session.id]: event.target.value,
                                        }))
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="secondary-action"
                                    disabled={
                                      sendingCode !== null ||
                                      !authorizationCodes[session.id]?.trim()
                                    }
                                    onClick={() => void sendAuthorizationCode(session.id)}
                                  >
                                    Enviar código de autorização
                                  </button>
                                </div>
                              )
                            ) : null}
                            <span>
                              Informe esse código na página oficial. Se a aba foi bloqueada, use o
                              link acima. Aguarde a confirmação de assinatura conectada nesta tela.
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                  <div className="account-title">
                    <div
                      className={`provider-mark provider-mark--${installation.provider.toLowerCase()}`}
                    >
                      {providerLabels[installation.provider].slice(0, 1)}
                    </div>
                    <div>
                      <h3>{providerLabels[installation.provider]}</h3>
                      <span>{installation.authMode}</span>
                    </div>
                    <span className={`status status--${installation.state.toLowerCase()}`}>
                      {statusLabel(installation.state)}
                    </span>
                  </div>
                  <label>
                    Provider
                    <select
                      value={installation.provider}
                      onChange={(event) =>
                        updateInstallation({
                          provider: event.target.value as ProviderInstallation["provider"],
                        })
                      }
                    >
                      {Object.entries(providerLabels).map(([provider, label]) => (
                        <option key={provider} value={provider}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nome da conta
                    <input
                      value={installation.label}
                      onChange={(event) => updateInstallation({ label: event.target.value })}
                    />
                  </label>
                  <label>
                    Executável
                    <input
                      value={installation.executable}
                      onChange={(event) => updateInstallation({ executable: event.target.value })}
                    />
                  </label>
                  <label>
                    Modelos permitidos, um por linha
                    <textarea
                      value={installation.models.join("\n")}
                      onChange={(event) => {
                        const models = [
                          ...new Set(
                            event.target.value
                              .split("\n")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          ),
                        ];
                        updateInstallation({
                          models,
                          defaultModel: models.includes(installation.defaultModel ?? "")
                            ? installation.defaultModel
                            : (models[0] ?? null),
                        });
                      }}
                    />
                  </label>
                  <label>
                    Modelo padrão
                    <select
                      value={installation.defaultModel ?? ""}
                      onChange={(event) =>
                        updateInstallation({ defaultModel: event.target.value || null })
                      }
                    >
                      <option value="">Nenhum</option>
                      {installation.models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={installation.enabled}
                      onChange={(event) => updateInstallation({ enabled: event.target.checked })}
                    />
                    <span>Disponível para atribuição</span>
                  </label>
                  <button
                    className="secondary-action account-action"
                    type="button"
                    disabled={
                      saving ||
                      requestingVerification !== null ||
                      verifications.some(
                        (item) =>
                          item.installationId === installation.id &&
                          ["PENDING", "RUNNING"].includes(item.status),
                      ) ||
                      !settings.configuration.installations.some(
                        (item) => item.id === installation.id,
                      )
                    }
                    onClick={() => verify(installation.id)}
                  >
                    {requestingVerification === installation.id
                      ? "Enviando…"
                      : verifications.some(
                            (item) =>
                              item.installationId === installation.id &&
                              ["PENDING", "RUNNING"].includes(item.status),
                          )
                        ? "Verificação em andamento…"
                        : "Verificar conta e modelos"}
                  </button>
                  {settings.configuration.installations.some(
                    (item) => item.id === installation.id && item.enabled,
                  ) && installation.state === "AUTH_REQUIRED" ? (
                    <button
                      className="secondary-action account-action"
                      type="button"
                      onClick={() => connect(installation.id)}
                      disabled={
                        connectingInstallation !== null ||
                        onboardingSessions.some(
                          (item) =>
                            item.installationId === installation.id &&
                            ["PENDING", "RUNNING", "AWAITING_USER"].includes(item.status),
                        )
                      }
                    >
                      {installation.provider === "ANTIGRAVITY"
                        ? "Conectar conta Google"
                        : `Conectar assinatura ${providerLabels[installation.provider]}`}
                    </button>
                  ) : null}
                  {installation.provider === "CLAUDE" ? (
                    <p>
                      Conecte sua assinatura na aba oficial; se o navegador apresentar um código,
                      cole-o neste modal. Os modelos Claude são informados no campo acima; o status
                      oficial não fornece um catálogo.
                    </p>
                  ) : null}
                  {installation.provider === "CODEX" ? (
                    <p>
                      Salve e habilite a conta, conecte sua assinatura e clique em Verificar conta e
                      modelos para importar o catálogo oficial. Os modelos ficarão disponíveis nos
                      funcionários digitais.
                    </p>
                  ) : null}
                  {installation.provider === "ANTIGRAVITY" ? (
                    <p>
                      Conecte sua conta Google pelo fluxo oficial; se solicitado, devolva o código
                      ao modal. A confirmação depende de armazenamento seguro da sessão no cliente.
                      Integração de execução ainda indisponível.
                    </p>
                  ) : null}
                  <button
                    className="remove-action"
                    type="button"
                    disabled={!draft.installations.some((item) => item.id === installation.id)}
                    onClick={() => removeInstallation(installation.id)}
                  >
                    Remover conta
                  </button>
                </SettingsModal>
              );
            })()}
        </section>

        <section className="panel settings-section">
          <div className="section-heading">
            <div>
              <p className="section-index">03</p>
              <h2>GitHub</h2>
            </div>
            <span className="status">{statusLabel(draft.github.state)}</span>
          </div>
          <button
            type="button"
            className="account-list-item"
            onClick={() => setEditingGithub(structuredClone(draft.github))}
            aria-label="Configurar GitHub"
          >
            <span className="provider-mark">G</span>
            <span className="account-list-name">
              <strong>
                {draft.github.owner && draft.github.repository
                  ? `${draft.github.owner}/${draft.github.repository}`
                  : "GitHub"}
              </strong>
              <span className="account-list-detail">
                {draft.github.host} · Branch {draft.github.baseBranch}
              </span>
              <span className="account-list-detail">
                {draft.github.pullRequestCreationEnabled
                  ? "PR com aprovação humana"
                  : "Criação de PR desabilitada"}
              </span>
            </span>
            <span className="status">{statusLabel(draft.github.state)}</span>
            <span className="account-list-edit">Configurar →</span>
          </button>
          {editingGithub && (
            <SettingsModal
              title="Configurar GitHub"
              saving={saving}
              onClose={() => setEditingGithub(null)}
              onSave={() => void saveGithubConfiguration()}
            >
              <div className="form-grid">
                <label>
                  Host
                  <input
                    value={editingGithub.host}
                    onChange={(event) =>
                      setEditingGithub({ ...editingGithub, host: event.target.value })
                    }
                  />
                </label>
                <label>
                  Organização / usuário
                  <input
                    value={editingGithub.owner ?? ""}
                    onChange={(event) =>
                      setEditingGithub({ ...editingGithub, owner: event.target.value || null })
                    }
                  />
                </label>
                <label>
                  Repositório
                  <input
                    value={editingGithub.repository ?? ""}
                    onChange={(event) =>
                      setEditingGithub({ ...editingGithub, repository: event.target.value || null })
                    }
                  />
                </label>
                <label>
                  Branch base
                  <input
                    value={editingGithub.baseBranch}
                    onChange={(event) =>
                      setEditingGithub({ ...editingGithub, baseBranch: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={editingGithub.pullRequestCreationEnabled}
                  onChange={(event) =>
                    setEditingGithub({
                      ...editingGithub,
                      pullRequestCreationEnabled: event.target.checked,
                    })
                  }
                />
                <span>Permitir criação de PR após gate humano</span>
              </label>
              <p className="security-note">
                Autenticação prevista via <strong>gh CLI</strong> no worker. Tokens não trafegam
                pelo painel.
              </p>
              {githubVerifications[0] ? (
                <p className="verification-line">
                  Verificação: <strong>{githubVerifications[0].status}</strong>
                  {githubVerifications[0].cliVersion
                    ? ` · ${githubVerifications[0].cliVersion}`
                    : ""}
                  {githubVerifications[0].message ? ` · ${githubVerifications[0].message}` : ""}
                </p>
              ) : null}
              {latestGithubOnboarding ? (
                <div className="onboarding-status">
                  <p>
                    Login: <strong>{statusLabel(latestGithubOnboarding.status)}</strong>
                    {latestGithubOnboarding.credentialStorage
                      ? ` · ${statusLabel(latestGithubOnboarding.credentialStorage)}`
                      : ""}
                    {latestGithubOnboarding.message ? ` · ${latestGithubOnboarding.message}` : ""}
                  </p>
                  {currentGithubChallenge ? (
                    <div className="onboarding-challenge">
                      <span>Abra o site oficial e informe o código temporário:</span>
                      <a
                        href={currentGithubChallenge.verificationUri}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {currentGithubChallenge.verificationUri}
                      </a>
                      <code>{currentGithubChallenge.userCode}</code>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {githubRepositoryVerifications[0] ? (
                <p className="verification-line">
                  Repositório: <strong>{githubRepositoryVerifications[0].status}</strong>
                  {githubRepositoryVerifications[0].access
                    ? ` · ${statusLabel(githubRepositoryVerifications[0].access)}`
                    : ""}
                  {githubRepositoryVerifications[0].observedOwner &&
                  githubRepositoryVerifications[0].observedRepository
                    ? ` · ${githubRepositoryVerifications[0].observedOwner}/${githubRepositoryVerifications[0].observedRepository}`
                    : ""}
                  {githubRepositoryVerifications[0].observedBaseBranch
                    ? ` · ${githubRepositoryVerifications[0].observedBaseBranch}`
                    : ""}
                  {githubRepositoryVerifications[0].message
                    ? ` · ${githubRepositoryVerifications[0].message}`
                    : ""}
                </p>
              ) : null}
              <button
                className="secondary-action account-action"
                type="button"
                onClick={verifyGithub}
                disabled={
                  githubVerifications.some((item) =>
                    ["PENDING", "RUNNING"].includes(item.status),
                  ) || hasActiveGithubOnboarding
                }
              >
                Verificar GitHub CLI
              </button>
              {settings.configuration.github.state === "AUTH_REQUIRED" ? (
                <button
                  className="secondary-action account-action"
                  type="button"
                  onClick={connectGithub}
                  disabled={
                    hasActiveGithubOnboarding ||
                    githubVerifications.some((item) => ["PENDING", "RUNNING"].includes(item.status))
                  }
                >
                  Conectar GitHub CLI
                </button>
              ) : null}
              <button
                className="secondary-action account-action"
                type="button"
                onClick={verifyGithubRepository}
                disabled={
                  settings.configuration.github.state !== "CONNECTED" ||
                  settings.configuration.github.owner === null ||
                  settings.configuration.github.repository === null ||
                  githubRepositoryVerifications.some((item) =>
                    ["PENDING", "RUNNING"].includes(item.status),
                  )
                }
              >
                Verificar repositório salvo (somente leitura)
              </button>
              <div className="onboarding-status">
                <p>
                  <strong>Pull request sob aprovação humana</strong>
                </p>
                <div className="form-grid">
                  <label>
                    Branch de origem
                    <input
                      value={pullRequestHead}
                      onChange={(event) => setPullRequestHead(event.target.value)}
                      placeholder="feature/minha-alteracao"
                    />
                  </label>
                  <label>
                    Título
                    <input
                      value={pullRequestTitle}
                      onChange={(event) => setPullRequestTitle(event.target.value)}
                      maxLength={200}
                    />
                  </label>
                </div>
                <label>
                  Descrição
                  <textarea
                    value={pullRequestBody}
                    onChange={(event) => setPullRequestBody(event.target.value)}
                    maxLength={10 * 1024}
                    rows={5}
                  />
                </label>
                <label className="switch-row compact">
                  <input
                    type="checkbox"
                    checked={pullRequestDraft}
                    onChange={(event) => setPullRequestDraft(event.target.checked)}
                  />
                  <span>Criar como draft</span>
                </label>
                <button
                  className="secondary-action account-action"
                  type="button"
                  onClick={preparePullRequest}
                  disabled={
                    settings.configuration.github.state !== "CONNECTED" ||
                    !settings.configuration.github.pullRequestCreationEnabled ||
                    pullRequestHead.trim() === "" ||
                    pullRequestTitle.trim() === "" ||
                    githubPullRequests.some((item) =>
                      ["PREPARED", "APPROVED", "RUNNING"].includes(item.status),
                    )
                  }
                >
                  Preparar PR para revisão
                </button>
                {latestGithubPullRequest ? (
                  <div className="verification-line">
                    <p>
                      Pedido: <strong>{statusLabel(latestGithubPullRequest.status)}</strong>
                      {` · ${latestGithubPullRequest.headBranch} → ${latestGithubPullRequest.baseBranch}`}
                      {` · digest ${latestGithubPullRequest.approvalDigest.slice(0, 12)}`}
                    </p>
                    <p>{latestGithubPullRequest.title}</p>
                    {latestGithubPullRequest.pullRequestUrl ? (
                      <a
                        href={latestGithubPullRequest.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Abrir PR #{latestGithubPullRequest.pullRequestNumber}
                      </a>
                    ) : null}
                    {latestGithubPullRequest.message ? (
                      <p>{latestGithubPullRequest.message}</p>
                    ) : null}
                    {latestGithubPullRequest.status === "PREPARED" ? (
                      <div>
                        <button
                          className="secondary-action account-action"
                          type="button"
                          onClick={() => approvePullRequest(latestGithubPullRequest)}
                        >
                          Aprovar e enviar ao worker
                        </button>
                        <button
                          className="secondary-action account-action"
                          type="button"
                          onClick={() => cancelPullRequest(latestGithubPullRequest)}
                        >
                          Cancelar preparação
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </SettingsModal>
          )}
        </section>
      </div>
      <div
        id="settings-panel-integrations"
        role="tabpanel"
        aria-labelledby="settings-tab-integrations"
        hidden={activeTab !== "integrations"}
        className="settings-tab-panel"
      >
        <section className="panel settings-section">
          <div className="section-heading">
            <div>
              <p className="section-index">MODELOS</p>
              <h2>Integrações IA</h2>
            </div>
            <p>Modelos configurados por conta para uso nas equipes.</p>
          </div>
          <div className="account-list">
            {draft.installations.length === 0 && (
              <p className="muted">Cadastre uma conta na aba Contas para configurar os modelos.</p>
            )}
            {draft.installations.map((installation) => (
              <button
                type="button"
                className="account-list-item"
                key={installation.id}
                onClick={() => {
                  setActiveTab("accounts");
                  setEditingInstallation(structuredClone(installation));
                }}
                aria-label={`Configurar modelos de ${installation.label}`}
              >
                <span
                  className={`provider-mark provider-mark--${installation.provider.toLowerCase()}`}
                >
                  {providerLabels[installation.provider].slice(0, 1)}
                </span>
                <span className="account-list-name">
                  <strong>{installation.label}</strong>
                  <span className="account-list-detail">
                    {installation.models.length
                      ? installation.models.join(" · ")
                      : "Nenhum modelo configurado"}
                  </span>
                </span>
                <span className={`status status--${installation.state.toLowerCase()}`}>
                  {statusLabel(installation.state)}
                </span>
                <span className="account-list-edit">Configurar →</span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel safety-card">
          <p className="section-index">POLÍTICA FINANCEIRA</p>
          <h2>Proteções ativas</h2>
          {["API paga", "Extra usage", "Créditos pagos", "Recarga automática", "Fallback pago"].map(
            (label) => (
              <div className="safety-row" key={label}>
                <span>{label}</span>
                <strong>DESLIGADO</strong>
              </div>
            ),
          )}
          <p className="security-note">
            Estas proteções são fixas neste MVP e não podem ser ativadas por esta tela.
          </p>
        </section>
      </div>
      <div
        id="settings-panel-teams"
        role="tabpanel"
        aria-labelledby="settings-tab-teams"
        hidden={activeTab !== "teams"}
        className="settings-tab-panel"
      >
        <TeamsPanel
          configuration={draft}
          projects={projects}
          activeProjectId={activeProjectId}
          saving={saving}
          onSave={save}
        >
          <PresetAgents
            configuring={Boolean(editingAssignment)}
            configuration={draft}
            saving={saving}
            onSave={save}
            onConfigure={(role) => {
              const assignment = draft.assignments.find((item) => item.role === role);
              if (assignment) setEditingAssignment(structuredClone(assignment));
            }}
          />
          {editingAssignment &&
            (() => {
              const assignment = editingAssignment;
              const selection =
                assignment.installationId && assignment.model
                  ? `${assignment.installationId}::${assignment.model}`
                  : "";
              return (
                <SettingsModal
                  title={`Configurar ${assignment.nickname || roleLabels[assignment.role]}`}
                  saving={saving}
                  onClose={() => setEditingAssignment(null)}
                  onSave={() => void saveAssignment()}
                >
                  <label>
                    Nome do agente
                    <input
                      autoComplete="off"
                      placeholder="Ex.: Alex"
                      value={assignment.nickname ?? ""}
                      maxLength={100}
                      onChange={(event) => updateAssignment({ nickname: event.target.value })}
                    />
                  </label>
                  <label>
                    Cargo na empresa
                    <input value={roleLabels[assignment.role]} readOnly />
                  </label>
                  <label>
                    Conta e modelo
                    <select
                      value={selection}
                      onChange={(event) => {
                        const [installationId, ...modelParts] = event.target.value.split("::");
                        updateAssignment({
                          installationId: installationId || null,
                          model: modelParts.join("::") || null,
                        });
                      }}
                    >
                      <option value="">Sem atribuição</option>
                      {draft.installations
                        .filter((item) => item.enabled)
                        .flatMap((item) =>
                          item.models.map((model) => (
                            <option key={`${item.id}:${model}`} value={`${item.id}::${model}`}>
                              {item.label} · {model}
                            </option>
                          )),
                        )}
                    </select>
                  </label>
                  <HandoffAlternatives
                    assignment={assignment}
                    installations={draft.installations}
                    onChange={(alternatives) => updateAssignment({ alternatives })}
                  />
                  <label>
                    Permissão
                    <select
                      value={assignment.permissionMode}
                      onChange={(event) =>
                        updateAssignment({
                          permissionMode: event.target.value as AgentAssignment["permissionMode"],
                        })
                      }
                    >
                      <option value="READ_ONLY">Somente leitura</option>
                      <option value="WORKSPACE_WRITE">Escrita no workspace</option>
                    </select>
                  </label>
                  <label>
                    Minutos
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={assignment.timeoutMinutes}
                      onChange={(event) =>
                        updateAssignment({ timeoutMinutes: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Tentativas
                    <select
                      value={assignment.maxAttempts}
                      onChange={(event) =>
                        updateAssignment({ maxAttempts: Number(event.target.value) })
                      }
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </label>
                  <label className="switch-row compact">
                    <input
                      type="checkbox"
                      checked={assignment.enabled}
                      onChange={(event) => updateAssignment({ enabled: event.target.checked })}
                    />
                    <span>Ativo</span>
                  </label>
                </SettingsModal>
              );
            })()}
        </TeamsPanel>
      </div>
    </div>
  );
}
