import type {
  AgentAssignment,
  FactoryConfiguration,
  FactorySettings,
  GithubOnboardingChallenge,
  GithubOnboardingSession,
  GithubPullRequest,
  GithubRepositoryVerification,
  GithubVerification,
  ProviderInstallation,
  ProviderOnboardingChallenge,
  ProviderOnboardingSession,
  ProviderVerification,
} from "@le-fabrique/contracts";
import { useEffect, useMemo, useState } from "react";
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
  updateFactorySettings,
} from "./control-api";
import { configurationSummary, providerLabels, roleLabels } from "./settings-view-model";

type SettingsPanelProps = { token: string; onMessage: (message: string) => void };

function statusLabel(state: string) {
  return state.replaceAll("_", " ");
}

export function SettingsPanel({ token, onMessage }: SettingsPanelProps) {
  const [settings, setSettings] = useState<FactorySettings | null>(null);
  const [draft, setDraft] = useState<FactoryConfiguration | null>(null);
  const [saving, setSaving] = useState(false);
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
        const observedStates = new Map(
          data.configuration.installations.map((item) => [item.id, item.state]),
        );
        return {
          ...current,
          installations: current.installations.map((item) => ({
            ...item,
            state: observedStates.get(item.id) ?? item.state,
          })),
        };
      });
      setOnboardingSessions(sessions);
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
      setOnboardingChallenges(Object.fromEntries(challenges.filter((item) => item !== null)));
    };
    void refresh().catch(() => onMessage("Falha ao atualizar o login do Codex."));
    const timer = setInterval(() => {
      void refresh().catch(() => onMessage("Falha ao atualizar o login do Codex."));
    }, 2_000);
    return () => clearInterval(timer);
  }, [hasActiveOnboarding, onMessage, token]);

  useEffect(() => {
    if (!verifications.some((item) => ["PENDING", "RUNNING"].includes(item.status))) return;
    const timer = setInterval(() => {
      void Promise.all([getFactorySettings(token), listProviderVerifications(token)]).then(
        ([data, history]) => {
          setSettings(data);
          setDraft((current) => {
            if (!current) return current;
            const observedStates = new Map(
              data.configuration.installations.map((item) => [item.id, item.state]),
            );
            return {
              ...current,
              installations: current.installations.map((item) => ({
                ...item,
                state: observedStates.get(item.id) ?? item.state,
              })),
            };
          });
          setVerifications(history);
        },
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

  function updateInstallation(index: number, patch: Partial<ProviderInstallation>) {
    setDraft((current) => {
      if (!current) return current;
      const installations = [...current.installations];
      const installation = installations[index];
      if (!installation) return current;
      const updated = { ...installation, ...patch };
      installations[index] = updated;
      const assignments = current.assignments.map((assignment) =>
        assignment.installationId === updated.id &&
        (!updated.enabled ||
          assignment.model === null ||
          !updated.models.includes(assignment.model))
          ? { ...assignment, enabled: false, installationId: null, model: null }
          : assignment,
      );
      return { ...current, installations, assignments };
    });
  }

  function updateAssignment(index: number, patch: Partial<AgentAssignment>) {
    setDraft((current) => {
      if (!current) return current;
      const assignments = [...current.assignments];
      const assignment = assignments[index];
      if (!assignment) return current;
      assignments[index] = { ...assignment, ...patch };
      return { ...current, assignments };
    });
  }

  function addInstallation() {
    setDraft((current) => {
      if (!current || current.installations.length >= 20) return current;
      return {
        ...current,
        installations: [
          ...current.installations,
          {
            id: `account-${crypto.randomUUID()}`,
            provider: "CODEX",
            label: "Nova conta Codex",
            executable: "codex",
            enabled: false,
            state: "AUTH_REQUIRED",
            authMode: "SUBSCRIPTION_CLI",
            models: [],
            defaultModel: null,
          },
        ],
      };
    });
  }

  function removeInstallation(installationId: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            installations: current.installations.filter((item) => item.id !== installationId),
            assignments: current.assignments.map((assignment) =>
              assignment.installationId === installationId
                ? { ...assignment, enabled: false, installationId: null, model: null }
                : assignment,
            ),
          }
        : current,
    );
  }

  async function save() {
    if (!settings || !draft) return;
    setSaving(true);
    try {
      const updated = await updateFactorySettings(token, {
        expectedVersion: settings.version,
        configuration: draft,
      });
      setSettings(updated);
      setDraft(structuredClone(updated.configuration));
      onMessage(`Configurações salvas na versão ${updated.version}.`);
    } catch {
      onMessage("Configuração inválida ou desatualizada; revise os campos e recarregue.");
    } finally {
      setSaving(false);
    }
  }

  async function verify(installationId: string) {
    try {
      const verification = await requestProviderVerification(token, installationId);
      setVerifications((current) => [
        verification,
        ...current.filter((item) => item.id !== verification.id),
      ]);
      onMessage("Verificação enviada ao worker; nenhum prompt será executado.");
    } catch {
      onMessage("Não foi possível solicitar a verificação desta instalação.");
    }
  }

  async function connect(installationId: string) {
    try {
      const session = await requestProviderOnboarding(token, installationId);
      setOnboardingSessions((current) => [
        session,
        ...current.filter((item) => item.id !== session.id),
      ]);
      onMessage("Login oficial iniciado; aguarde o código temporário.");
    } catch {
      onMessage("Não foi possível iniciar o login desta instalação.");
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
        <button type="button" onClick={save} disabled={saving}>
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

      <section className="panel settings-section">
        <div className="section-heading">
          <div>
            <p className="section-index">01</p>
            <h2>IA e contas</h2>
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
        <div className="account-grid">
          {draft.installations.map((installation, index) => (
            <article className="account-card" key={installation.id}>
              {(() => {
                const latest = verifications.find(
                  (item) => item.installationId === installation.id,
                );
                return latest ? (
                  <p className="verification-line">
                    Verificação: <strong>{latest.status}</strong>
                    {latest.cliVersion ? ` · ${latest.cliVersion}` : ""}
                  </p>
                ) : null;
              })()}
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
                    {challenge ? (
                      <div className="onboarding-challenge">
                        <span>Abra o site oficial e informe o código temporário:</span>
                        <a
                          href={challenge.verificationUri}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {challenge.verificationUri}
                        </a>
                        <code>{challenge.userCode}</code>
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
                    updateInstallation(index, {
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
                  onChange={(event) => updateInstallation(index, { label: event.target.value })}
                />
              </label>
              <label>
                Executável
                <input
                  value={installation.executable}
                  onChange={(event) =>
                    updateInstallation(index, { executable: event.target.value })
                  }
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
                    updateInstallation(index, {
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
                    updateInstallation(index, { defaultModel: event.target.value || null })
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
                  onChange={(event) => updateInstallation(index, { enabled: event.target.checked })}
                />
                <span>Disponível para atribuição</span>
              </label>
              <button
                className="secondary-action account-action"
                type="button"
                onClick={() => verify(installation.id)}
              >
                Verificar instalação
              </button>
              {installation.provider === "CODEX" &&
              installation.enabled &&
              installation.state === "AUTH_REQUIRED" ? (
                <button
                  className="secondary-action account-action"
                  type="button"
                  onClick={() => connect(installation.id)}
                  disabled={onboardingSessions.some(
                    (item) =>
                      item.installationId === installation.id &&
                      ["PENDING", "RUNNING", "AWAITING_USER"].includes(item.status),
                  )}
                >
                  Conectar assinatura Codex
                </button>
              ) : null}
              <button
                className="remove-action"
                type="button"
                onClick={() => removeInstallation(installation.id)}
              >
                Remover conta
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel settings-section">
        <div className="section-heading">
          <div>
            <p className="section-index">02</p>
            <h2>Funcionários digitais</h2>
          </div>
          <p>Escolha conta, modelo, permissão e limites por responsabilidade.</p>
        </div>
        <div className="assignment-list">
          {draft.assignments.map((assignment, index) => {
            const selection =
              assignment.installationId && assignment.model
                ? `${assignment.installationId}::${assignment.model}`
                : "";
            return (
              <article className="assignment-row" key={assignment.role}>
                <div>
                  <h3>{roleLabels[assignment.role]}</h3>
                  <span>
                    {assignment.permissionMode === "READ_ONLY"
                      ? "Somente leitura"
                      : "Escrita no workspace"}
                  </span>
                </div>
                <label>
                  Conta e modelo
                  <select
                    value={selection}
                    onChange={(event) => {
                      const [installationId, ...modelParts] = event.target.value.split("::");
                      updateAssignment(index, {
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
                <label>
                  Permissão
                  <select
                    value={assignment.permissionMode}
                    onChange={(event) =>
                      updateAssignment(index, {
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
                      updateAssignment(index, { timeoutMinutes: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Tentativas
                  <select
                    value={assignment.maxAttempts}
                    onChange={(event) =>
                      updateAssignment(index, { maxAttempts: Number(event.target.value) })
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
                    onChange={(event) => updateAssignment(index, { enabled: event.target.checked })}
                  />
                  <span>Ativo</span>
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <section className="settings-bottom-grid">
        <section className="panel settings-section">
          <div className="section-heading">
            <div>
              <p className="section-index">03</p>
              <h2>GitHub</h2>
            </div>
            <span className="status">{statusLabel(draft.github.state)}</span>
          </div>
          <div className="form-grid">
            <label>
              Host
              <input
                value={draft.github.host}
                onChange={(event) =>
                  setDraft({ ...draft, github: { ...draft.github, host: event.target.value } })
                }
              />
            </label>
            <label>
              Organização / usuário
              <input
                value={draft.github.owner ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    github: { ...draft.github, owner: event.target.value || null },
                  })
                }
              />
            </label>
            <label>
              Repositório
              <input
                value={draft.github.repository ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    github: { ...draft.github, repository: event.target.value || null },
                  })
                }
              />
            </label>
            <label>
              Branch base
              <input
                value={draft.github.baseBranch}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    github: { ...draft.github, baseBranch: event.target.value },
                  })
                }
              />
            </label>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={draft.github.pullRequestCreationEnabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  github: { ...draft.github, pullRequestCreationEnabled: event.target.checked },
                })
              }
            />
            <span>Permitir criação de PR após gate humano</span>
          </label>
          <p className="security-note">
            Autenticação prevista via <strong>gh CLI</strong> no worker. Tokens não trafegam pelo
            painel.
          </p>
          {githubVerifications[0] ? (
            <p className="verification-line">
              Verificação: <strong>{githubVerifications[0].status}</strong>
              {githubVerifications[0].cliVersion ? ` · ${githubVerifications[0].cliVersion}` : ""}
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
              githubVerifications.some((item) => ["PENDING", "RUNNING"].includes(item.status)) ||
              hasActiveGithubOnboarding
            }
          >
            Verificar GitHub CLI
          </button>
          {draft.github.state === "AUTH_REQUIRED" ? (
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
                {latestGithubPullRequest.message ? <p>{latestGithubPullRequest.message}</p> : null}
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
      </section>
    </div>
  );
}
