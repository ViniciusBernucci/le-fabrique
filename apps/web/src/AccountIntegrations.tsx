import {
  type AccountIntegrationList,
  type AccountSession,
  accountIntegrationListSchema,
  type Project,
  projectListSchema,
  providerOnboardingChallengeSchema,
  providerOnboardingSessionSchema,
} from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { accountRequest } from "./account-api";
export function AccountIntegrations({ session }: { session: AccountSession }) {
  const [rows, setRows] = useState<AccountIntegrationList>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState<{
    integrationId: string;
    sessionId: string;
    state: string;
  } | null>(null);
  const [challenge, setChallenge] = useState<ReturnType<
    typeof providerOnboardingChallengeSchema.parse
  > | null>(null);
  const [provider, setProvider] = useState("CODEX");
  const [mode, setMode] = useState("SUBSCRIPTION_CLI");
  async function load(signal?: AbortSignal) {
    const [integrations, projectRows] = await Promise.all([
      accountRequest("/integrations", session, "GET", undefined, signal),
      accountRequest("/work/projects", session, "GET", undefined, signal),
    ]);
    setRows(accountIntegrationListSchema.parse(integrations));
    setProjects(projectListSchema.parse(projectRows));
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: load uses only the selected account session.
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal).catch((e) => {
      if (!abort.signal.aborted) setMessage(e.message);
    });
    return () => abort.abort();
  }, [session]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Poll this private login only while its id is selected.
  useEffect(() => {
    if (!login) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const result = providerOnboardingSessionSchema.parse(
          await accountRequest(
            `/integrations/${login.integrationId}/login/${login.sessionId}`,
            session,
            "GET",
            undefined,
            abort.signal,
          ),
        );
        if (abort.signal.aborted) return;
        setLogin((current) => (current ? { ...current, state: result.status } : null));
        if (result.status === "AWAITING_USER")
          setChallenge(
            providerOnboardingChallengeSchema.parse(
              await accountRequest(
                `/integrations/${login.integrationId}/login/${login.sessionId}/challenge`,
                session,
                "GET",
                undefined,
                abort.signal,
              ),
            ),
          );
        if (["PENDING", "RUNNING", "AWAITING_USER"].includes(result.status))
          timer = setTimeout(() => void poll(), 2500);
        else {
          await load(abort.signal);
          setMessage(result.message ?? result.status);
        }
      } catch (e) {
        if (!abort.signal.aborted) setMessage(e instanceof Error ? e.message : "Falha no login.");
      }
    };
    void poll();
    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [session, login?.sessionId]);
  async function act(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setMessage("");
    try {
      const result = await accountRequest(path, session, method, body);
      if (path.endsWith("/login")) {
        const s = providerOnboardingSessionSchema.parse(result);
        setLogin({ integrationId: path.split("/")[2] ?? "", sessionId: s.id, state: s.status });
        setChallenge(null);
      }
      await load();
      setMessage("Solicitação registrada.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Minhas integrações e assinaturas de IA</h2>
        <p>
          Cadastre suas próprias instalações e autorize cada projeto. As credenciais ficam privadas.
          Registrar uma chave API não habilita gastos nem executa chamadas de IA.
        </p>
        {message && <p role="status">{message}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const d = new FormData(form);
            void act("/integrations", {
              name: String(d.get("name")),
              provider,
              mode,
              models: String(d.get("models"))
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              subscriptionLabel: String(d.get("subscriptionLabel")),
              fixedCostMinor: d.get("fixedCost")
                ? Math.round(Number(d.get("fixedCost")) * 100)
                : null,
              currency: String(d.get("currency")),
              ...(mode !== "SUBSCRIPTION_CLI" ? { secret: String(d.get("secret")) } : {}),
            }).then(() => {
              const input = form.elements.namedItem("secret");
              if (input instanceof HTMLInputElement) input.value = "";
            });
          }}
        >
          <fieldset disabled={busy} className="account-form">
            <label>
              Nome da integração
              <input name="name" maxLength={100} required />
            </label>
            <label>
              Serviço
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setMode(e.target.value === "GITHUB" ? "GITHUB_TOKEN" : "SUBSCRIPTION_CLI");
                }}
              >
                {["CODEX", "CLAUDE", "ANTIGRAVITY", "GITHUB"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            {!["GITHUB", "ANTIGRAVITY"].includes(provider) && (
              <label>
                Tipo de acesso
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="SUBSCRIPTION_CLI">Assinatura pelo cliente oficial</option>
                  <option value="API_KEY">Chave API (cadastro, execução desabilitada)</option>
                </select>
              </label>
            )}
            {mode !== "SUBSCRIPTION_CLI" && (
              <label>
                Credencial privada
                <input name="secret" type="password" required maxLength={4096} autoComplete="off" />
              </label>
            )}
            <label>
              Modelos disponíveis (um por linha)
              <textarea name="models" maxLength={6000} />
            </label>
            <label>
              Nome da assinatura
              <input name="subscriptionLabel" maxLength={100} />
            </label>
            <label>
              Custo fixo informado por você
              <input name="fixedCost" type="number" min={0} step="0.01" />
            </label>
            <label>
              Moeda
              <input name="currency" defaultValue="EUR" required pattern="[A-Z]{3}" maxLength={3} />
            </label>
            <button type="submit">Adicionar integração</button>
          </fieldset>
        </form>
      </section>
      <section className="panel">
        <h2>Integrações cadastradas</h2>
        {rows.length === 0 && <p>Nenhuma integração cadastrada.</p>}
        {rows.map((i) => (
          <article key={i.id} className="panel">
            <h3>{i.name}</h3>
            <p>
              {i.provider} · {i.mode} · {i.enabled ? i.state : "Desativada"}
            </p>
            <p>
              Assinatura: {i.configuration.subscriptionLabel || "Não informada"} · Custo fixo:{" "}
              {i.configuration.fixedCostMinor === null
                ? "Não informado"
                : new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: i.configuration.currency,
                  }).format(i.configuration.fixedCostMinor / 100)}
            </p>
            {i.credentialConfigured && <p>Credencial registrada e protegida.</p>}
            <div className="account-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(
                    `/integrations/${i.id}`,
                    { enabled: !i.enabled, expectedVersion: i.version },
                    "PATCH",
                  )
                }
              >
                {i.enabled ? "Desativar" : "Ativar"}
              </button>
              {i.mode === "SUBSCRIPTION_CLI" && i.enabled && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(`/integrations/${i.id}/login`)}
                  >
                    Conectar pelo cliente oficial
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(`/integrations/${i.id}/verify`)}
                  >
                    Verificar conexão
                  </button>
                </>
              )}
              {i.provider === "GITHUB" && i.enabled && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(`/integrations/${i.id}/verify`)}
                >
                  Verificar conexão GitHub
                </button>
              )}
            </div>
            <h4>Projetos autorizados</h4>
            {projects.map((p) => (
              <label key={p.id} className="account-check">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={i.grants.some((g) => g.projectId === p.id)}
                  onChange={(e) =>
                    void act(
                      `/integrations/${i.id}/projects/${p.id}`,
                      { enabled: e.target.checked },
                      "PUT",
                    )
                  }
                />
                {p.name}
              </label>
            ))}
          </article>
        ))}
      </section>
      {login && (
        <section className="panel">
          <h2>Conectar assinatura</h2>
          <p>{login.state}</p>
          {challenge && (
            <>
              <a href={challenge.verificationUri} target="_blank" rel="noopener noreferrer">
                Abrir autorização no serviço
              </a>
              {challenge.userCode && <p>Código: {challenge.userCode}</p>}
              {challenge.provider === "CLAUDE" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void act(`/integrations/${login.integrationId}/login/${login.sessionId}/code`, {
                      code: String(d.get("code")),
                    });
                    e.currentTarget.reset();
                  }}
                >
                  <label>
                    Código de autorização
                    <input name="code" type="password" required autoComplete="off" />
                  </label>
                  <button type="submit" disabled={busy}>
                    Enviar código
                  </button>
                </form>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setLogin(null);
              setChallenge(null);
            }}
          >
            Fechar acompanhamento
          </button>
        </section>
      )}
    </>
  );
}
