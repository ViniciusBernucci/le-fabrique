import {
  type AccountIntegrationList,
  type AccountOverview,
  type AccountSession,
  accountIntegrationListSchema,
  type ExecutionArtifact,
  executionArtifactStateSchema,
  factoryConfigurationSchema,
  type Project,
  projectDefinitionSchema,
  projectDefinitionStateSchema,
  projectListSchema,
  type RunDeliveryState,
  type RunDetail,
  type RunSummary,
  runDeliveryStateSchema,
  runDetailSchema,
  runListSchema,
  type Ticket,
  ticketListSchema,
} from "@le-fabrique/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArtifactView } from "./ArtifactPanel";
import { accountRequest } from "./account-api";
import { ProjectDefinitionPanel } from "./ProjectDefinitionPanel";

const grantSchema = z.array(z.object({ membershipId: z.uuid(), role: z.string() }));
export function AccountProjects({
  session,
  overview,
}: {
  session: AccountSession;
  overview: AccountOverview | null;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [delivery, setDelivery] = useState<RunDeliveryState | null>(null);
  const [artifact, setArtifact] = useState<ExecutionArtifact | null>(null);
  const [grants, setGrants] = useState<z.infer<typeof grantSchema>>([]);
  const [integrations, setIntegrations] = useState<AccountIntegrationList>([]);
  const [routeValues, setRouteValues] = useState<
    Record<string, { installationId: string; model: string }>
  >({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [runId, setRunId] = useState("");
  const manager = ["OWNER", "ADMIN"].includes(session.organization.role);
  const operator = manager || session.organization.role === "OPERATOR";
  const approver = manager || session.organization.role === "APPROVER";
  const project = projects.find((p) => p.id === projectId);
  const notice = useCallback((m: string) => setMessage(m), []);
  const ignore = useCallback(() => {}, []);
  const api = useMemo(
    () => ({
      get: async (_token: string, id: string) =>
        projectDefinitionStateSchema.parse(
          await accountRequest(`/work/projects/${id}/definition`, session),
        ).definition,
      put: async (
        _token: string,
        id: string,
        expectedVersion: number,
        definition: Parameters<typeof import("./control-api").putProjectDefinition>[3],
      ) =>
        projectDefinitionSchema.parse(
          await accountRequest(`/work/projects/${id}/definition`, session, "PUT", {
            expectedVersion,
            definition,
          }),
        ),
    }),
    [session],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: A successful mutation invalidates the project snapshot.
  useEffect(() => {
    const abort = new AbortController();
    void accountRequest("/work/projects", session, "GET", undefined, abort.signal)
      .then((r) => {
        const list = projectListSchema.parse(r);
        setProjects(list);
        setProjectId((id) => (list.some((p) => p.id === id) ? id : (list[0]?.id ?? "")));
      })
      .catch((e) => {
        if (!abort.signal.aborted) setMessage(e.message);
      });
    return () => abort.abort();
  }, [session, refresh]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A successful mutation invalidates tickets, grants and routes.
  useEffect(() => {
    setTickets([]);
    setRuns([]);
    setDetail(null);
    setDelivery(null);
    setArtifact(null);
    setRunId("");
    if (!projectId) return;
    const abort = new AbortController();
    void Promise.all([
      accountRequest(
        `/work/projects/${projectId}/tickets`,
        session,
        "GET",
        undefined,
        abort.signal,
      ).then((r) => setTickets(ticketListSchema.parse(r))),
      accountRequest(
        `/work/projects/${projectId}/runs`,
        session,
        "GET",
        undefined,
        abort.signal,
      ).then((r) => setRuns(runListSchema.parse(r))),
      manager
        ? Promise.all([
            accountRequest(
              `/work/projects/${projectId}/grants`,
              session,
              "GET",
              undefined,
              abort.signal,
            ).then((r) => setGrants(grantSchema.parse(r))),
            accountRequest("/integrations", session, "GET", undefined, abort.signal).then((r) =>
              setIntegrations(accountIntegrationListSchema.parse(r)),
            ),
            accountRequest(
              `/work/projects/${projectId}/routes`,
              session,
              "GET",
              undefined,
              abort.signal,
            ).then((r) => {
              if (r === null) {
                setRouteValues({});
                return;
              }
              const cfg = factoryConfigurationSchema.parse(
                z.object({ configuration: z.unknown() }).parse(r).configuration,
              );
              setRouteValues(
                Object.fromEntries(
                  cfg.assignments.map((a) => [
                    a.role,
                    { installationId: a.installationId ?? "", model: a.model ?? "" },
                  ]),
                ),
              );
            }),
          ])
        : Promise.resolve(),
    ]).catch((e) => {
      if (!abort.signal.aborted) setMessage(e.message);
    });
    return () => abort.abort();
  }, [session, projectId, refresh, manager]);
  useEffect(() => {
    setDetail(null);
    setDelivery(null);
    setArtifact(null);
    if (!runId) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const [r, d] = await Promise.all([
          accountRequest(`/work/runs/${runId}`, session, "GET", undefined, abort.signal),
          accountRequest(`/work/runs/${runId}/delivery`, session, "GET", undefined, abort.signal),
        ]);
        if (abort.signal.aborted) return;
        setDetail(runDetailSchema.parse(r));
        setDelivery(runDeliveryStateSchema.parse(d));
        timer = setTimeout(() => void poll(), 4000);
      } catch (e) {
        if (!abort.signal.aborted)
          setMessage(e instanceof Error ? e.message : "Falha ao carregar execução.");
      }
    };
    void poll();
    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [session, runId]);
  async function act(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setMessage("");
    try {
      await accountRequest(`/work${path}`, session, method, body);
      setRefresh((v) => v + 1);
      setMessage("Operação concluída.");
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na operação.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function loadArtifact() {
    if (!detail?.attempts[0]) return;
    setBusy(true);
    try {
      const response = await accountRequest(
        `/work/runs/${detail.id}/attempts/${detail.attempts[0].id}/artifact`,
        session,
      );
      setArtifact(executionArtifactStateSchema.parse(response).artifact);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Artefatos indisponíveis.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {message && <p role="status">{message}</p>}
      <section className="panel">
        <h2>Projetos da minha conta</h2>
        <label>
          Projeto
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Selecione um projeto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {manager && (
          <details>
            <summary>Criar projeto</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const d = new FormData(form);
                void act("/projects", {
                  name: String(d.get("name")),
                  repoUrl: String(d.get("repoUrl")),
                  baseRef: String(d.get("baseRef")),
                }).then((ok) => {
                  if (ok) form.reset();
                });
              }}
            >
              <fieldset disabled={busy} className="account-form">
                <label>
                  Nome
                  <input name="name" maxLength={120} required />
                </label>
                <label>
                  URL do repositório
                  <input name="repoUrl" type="url" required />
                </label>
                <label>
                  Revisão inicial (commit Git)
                  <input name="baseRef" maxLength={40} pattern="[a-f0-9]{40}" required />
                </label>
                <button type="submit">Criar projeto</button>
              </fieldset>
            </form>
          </details>
        )}
      </section>
      {project && (
        <>
          {manager && (
            <>
              <ProjectDefinitionPanel
                key={project.id}
                token=""
                project={project}
                api={api}
                onMessage={notice}
                onVersion={ignore}
                onProfileReady={ignore}
              />
              <section className="panel">
                <h2>Acesso ao projeto</h2>
                {overview?.members
                  .filter((m) => m.status === "ACTIVE" && !["OWNER", "ADMIN"].includes(m.role))
                  .map((m) => (
                    <form
                      key={m.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const role = String(new FormData(e.currentTarget).get("role"));
                        void act(
                          role
                            ? `/projects/${projectId}/grants`
                            : `/projects/${projectId}/grants/${m.id}`,
                          role ? { membershipId: m.id, role } : undefined,
                          role ? "PUT" : "DELETE",
                        );
                      }}
                    >
                      <fieldset disabled={busy} className="account-member-form">
                        <label>
                          {m.name}
                          <select
                            key={grants.find((g) => g.membershipId === m.id)?.role ?? "none"}
                            name="role"
                            defaultValue={grants.find((g) => g.membershipId === m.id)?.role ?? ""}
                          >
                            <option value="">Sem acesso</option>
                            <option value="READER">Leitura</option>
                            <option value="OPERATOR">
                              Operação (exige papel Operador na conta)
                            </option>
                            <option value="APPROVER">
                              Aceite (exige papel Aprovador na conta)
                            </option>
                          </select>
                        </label>
                        <button type="submit">Salvar acesso</button>
                      </fieldset>
                    </form>
                  ))}
              </section>
              <section className="panel">
                <h2>Agentes do projeto</h2>
                <p>Autorize as integrações para este projeto antes de escolher os agentes.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(
                      `/projects/${projectId}/routes`,
                      ["PLANNER", "DEVELOPER", "REVIEWER", "QA", "DOCUMENTATION", "SECURITY"].map(
                        (role) => ({
                          role,
                          enabled: !!routeValues[role]?.installationId,
                          installationId: routeValues[role]?.installationId || null,
                          model: routeValues[role]?.model || null,
                          permissionMode: role === "DEVELOPER" ? "WORKSPACE_WRITE" : "READ_ONLY",
                          timeoutMinutes: 15,
                          maxAttempts: 2,
                        }),
                      ),
                      "PUT",
                    );
                  }}
                >
                  <fieldset disabled={busy} className="account-form">
                    {["DEVELOPER", "REVIEWER"].map((role) => (
                      <div key={role}>
                        <label>
                          {role === "DEVELOPER" ? "Desenvolvedor" : "Revisor"}
                          <select
                            value={routeValues[role]?.installationId ?? ""}
                            onChange={(e) =>
                              setRouteValues((v) => ({
                                ...v,
                                [role]: { installationId: e.target.value, model: "" },
                              }))
                            }
                          >
                            <option value="">Não configurado</option>
                            {integrations
                              .filter(
                                (i) =>
                                  i.enabled &&
                                  i.mode === "SUBSCRIPTION_CLI" &&
                                  i.grants.some((g) => g.projectId === projectId),
                              )
                              .map((i) => (
                                <option key={i.id} value={i.runtimeId ?? ""}>
                                  {i.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Modelo
                          <select
                            value={routeValues[role]?.model ?? ""}
                            onChange={(e) =>
                              setRouteValues((v) => ({
                                ...v,
                                [role]: {
                                  installationId: v[role]?.installationId ?? "",
                                  model: e.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Selecione</option>
                            {integrations
                              .find((i) => i.runtimeId === routeValues[role]?.installationId)
                              ?.configuration.models.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                          </select>
                        </label>
                      </div>
                    ))}
                    <button type="submit">Salvar agentes</button>
                  </fieldset>
                </form>
              </section>
            </>
          )}
          {operator && (
            <section className="panel">
              <h2>Criar trabalho</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const d = new FormData(form);
                  void act(`/projects/${projectId}/tickets`, {
                    title: String(d.get("title")),
                    objective: String(d.get("objective")),
                    acceptanceCriteria: String(d.get("criteria"))
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }).then((ok) => {
                    if (ok) form.reset();
                  });
                }}
              >
                <fieldset disabled={busy} className="account-form">
                  <label>
                    Título
                    <input name="title" required maxLength={160} />
                  </label>
                  <label>
                    Objetivo
                    <textarea name="objective" required maxLength={4000} />
                  </label>
                  <label>
                    Critérios de aceite (um por linha)
                    <textarea name="criteria" required maxLength={10000} />
                  </label>
                  <button type="submit">Criar trabalho</button>
                </fieldset>
              </form>
            </section>
          )}
          <section className="panel">
            <h2>Trabalhos</h2>
            {!tickets.length && <p>Nenhum trabalho criado.</p>}
            {tickets.map((t) => (
              <article key={t.id}>
                <h3>{t.title}</h3>
                <p>
                  {t.status} · {t.objective}
                </p>
                {t.status === "DRAFT" && operator && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(`/tickets/${t.id}/ready`, { expectedVersion: t.version })
                    }
                  >
                    Enviar para execução
                  </button>
                )}
              </article>
            ))}
          </section>
          <section className="panel">
            <h2>Execuções</h2>
            <button type="button" disabled={busy} onClick={() => setRefresh((v) => v + 1)}>
              Atualizar lista
            </button>
            {!runs.length && <p>Nenhuma execução registrada.</p>}
            {runs.map((r) => (
              <article key={r.id}>
                <button type="button" onClick={() => setRunId(r.id)}>
                  {r.title} · {r.status}
                </button>
              </article>
            ))}
            {detail && (
              <section>
                <h3>
                  {detail.title} · {detail.status}
                </h3>
                {detail.attempts.map((a) => (
                  <article key={a.id}>
                    <p>
                      Tentativa {a.sequence}: {a.status} ·{" "}
                      {a.stoppedConfirmed ? "Término confirmado" : "Término ainda não confirmado"}
                    </p>
                    <p>{a.result?.reason}</p>
                  </article>
                ))}
                {operator && detail.status === "RUNNING" && detail.attempts[0] && (
                  <div className="account-actions">
                    {["PAUSE", "CANCEL"].map((action) => (
                      <button
                        type="button"
                        key={action}
                        disabled={busy}
                        onClick={() =>
                          void act(`/runs/${detail.id}/control`, {
                            expectedVersion: detail.version,
                            attemptId: detail.attempts[0]?.id,
                            action,
                          })
                        }
                      >
                        {action === "PAUSE" ? "Pausar" : "Cancelar execução"}
                      </button>
                    ))}
                  </div>
                )}
                {delivery?.delivery && (
                  <>
                    <h4>Entrega para aceite</h4>
                    <pre className="account-document">{delivery.delivery.documentMarkdown}</pre>
                    {approver && !delivery.accepted && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void act(`/runs/${detail.id}/approval`, {
                            expectedVersion: detail.version,
                            attemptId: delivery.delivery?.attemptId,
                            deliveryDigest: delivery.delivery?.deliveryDigest,
                          })
                        }
                      >
                        Aceitar esta entrega
                      </button>
                    )}
                    {delivery.accepted && <p>Entrega aceita.</p>}
                  </>
                )}
                <button type="button" disabled={busy} onClick={() => void loadArtifact()}>
                  Carregar diff e artefatos
                </button>
                {artifact && <ArtifactView artifact={artifact} />}{" "}
                {operator &&
                  ["WAITING_PROVIDER", "PAUSED", "PAUSED_LIMIT", "FAILED", "CANCELLED"].includes(
                    detail.status,
                  ) &&
                  detail.attempts[0]?.stoppedConfirmed &&
                  artifact && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setBusy(true);
                        void crypto.subtle
                          .digest("SHA-256", new TextEncoder().encode(JSON.stringify(artifact)))
                          .then((hash) =>
                            act(`/runs/${detail.id}/resume`, {
                              expectedVersion: detail.version,
                              attemptId: detail.attempts[0]?.id,
                              artifactDigest: Array.from(new Uint8Array(hash), (b) =>
                                b.toString(16).padStart(2, "0"),
                              ).join(""),
                            }),
                          )
                          .catch((e) => setMessage(e.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      <label className="account-check">
                        <input type="checkbox" required />
                        Autorizo nova tentativa a partir dos artefatos preservados
                      </label>
                      <button type="submit" disabled={busy}>
                        Retomar trabalho
                      </button>
                    </form>
                  )}
              </section>
            )}
          </section>
        </>
      )}
    </>
  );
}
