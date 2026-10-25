import {
  type AccountBillingState,
  type AccountOverview,
  type AccountSession,
  accountBillingStateSchema,
  accountNotificationListSchema,
} from "@le-fabrique/contracts";
import { type FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import { FactorFields, sensitive } from "./AccountSecurityExtras";
import { accountRequest } from "./account-api";
export function AccountDataPanel({
  session,
  overview,
  refresh,
  mode,
  transferToken = "",
}: {
  session: AccountSession;
  overview: AccountOverview | null;
  refresh: () => Promise<void>;
  mode: "data" | "plan" | "notifications";
  transferToken?: string;
}) {
  const [billing, setBilling] = useState<AccountBillingState | null>(null);
  const [notifications, setNotifications] = useState<z.infer<typeof accountNotificationListSchema>>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const owner = session.organization.role === "OWNER";
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      accountRequest("/billing", session, "GET", undefined, abort.signal).then((r) =>
        setBilling(accountBillingStateSchema.parse(r)),
      ),
      mode === "notifications"
        ? accountRequest("/notifications", session, "GET", undefined, abort.signal).then((r) =>
            setNotifications(accountNotificationListSchema.parse(r)),
          )
        : Promise.resolve(),
    ]).catch((e) => {
      if (!abort.signal.aborted) setMessage(e.message);
    });
    return () => abort.abort();
  }, [session, mode]);
  async function act(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setMessage("");
    try {
      const result = await accountRequest(path, session, method, body);
      if (
        path.startsWith("/billing/") &&
        result &&
        typeof result === "object" &&
        "url" in result &&
        typeof result.url === "string"
      ) {
        const url = new URL(result.url);
        if (
          url.protocol !== "https:" ||
          !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
        )
          throw new Error("Destino inválido.");
        window.location.assign(url.toString());
        return;
      }
      if (path === "/billing/reconcile") {
        for (const key of Object.keys(sessionStorage))
          if (key.startsWith(`account-checkout:${session.organization.id}:`))
            sessionStorage.removeItem(key);
      }
      if (path !== "/archive") await refresh();
      if (path === "/archive") window.location.reload();
      setMessage("Operação concluída.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setBusy(true);
    setMessage("");
    try {
      const sections = [
        "profile",
        "projects",
        "tickets",
        "runs",
        "attempts",
        ...(["OWNER", "ADMIN"].includes(session.organization.role)
          ? ["members", "activity", "integrations"]
          : []),
      ];
      const exported: Record<string, unknown[]> = {};
      for (const section of sections) {
        let cursor = "";
        exported[section] = [];
        do {
          const page = z
            .object({
              organizationId: z.uuid(),
              rows: z.array(z.unknown()),
              nextCursor: z.uuid().nullable(),
            })
            .parse(
              await accountRequest(`/data/export?section=${section}&cursor=${cursor}`, session),
            );
          if (page.organizationId !== session.organization.id)
            throw new Error("A conta ativa mudou.");
          exported[section]?.push(...page.rows);
          cursor = page.nextCursor ?? "";
          if ((exported[section]?.length ?? 0) > 100000)
            throw new Error("A exportação excedeu o limite deste navegador.");
        } while (cursor);
      }
      const blob = new Blob(
        [
          JSON.stringify(
            {
              schemaVersion: 1,
              observedAt: new Date().toISOString(),
              organizationId: session.organization.id,
              sections: exported,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "minha-conta.json";
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Exportação baixada.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na exportação.");
    } finally {
      setBusy(false);
    }
  }
  const submit = (e: FormEvent<HTMLFormElement>, path: string, body: (d: FormData) => unknown) => {
    e.preventDefault();
    void act(path, body(new FormData(e.currentTarget)), path === "/data/settings" ? "PUT" : "POST");
  };
  return (
    <>
      {message && <p role="status">{message}</p>}
      {mode === "plan" && (
        <>
          <section className="panel">
            <h2>Meu plano La fabrique</h2>
            <p>
              {billing?.plan?.name ?? "Nenhum plano vinculado"} · {billing?.status ?? "Carregando"}
            </p>
            {billing?.currentPeriodEnd && (
              <p>
                {billing.cancelAtPeriodEnd ? "Cancelamento previsto" : "Renovação prevista"}:{" "}
                {new Date(billing.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {billing?.plan && (
              <p>
                Limites: {billing.plan.members} membros · {billing.plan.projects} projetos ·{" "}
                {Math.round(billing.plan.storageBytes / 1048576)} MB de artefatos
              </p>
            )}
            {owner && (
              <div className="account-actions">
                <button
                  type="button"
                  disabled={busy || !billing?.configured}
                  onClick={() => void act("/billing/portal")}
                >
                  Gerenciar assinatura, troca e cancelamento
                </button>
                <button
                  type="button"
                  disabled={busy || !billing?.configured}
                  onClick={() => void act("/billing/reconcile")}
                >
                  Atualizar situação do pagamento
                </button>
              </div>
            )}
            {billing?.catalog.length === 0 && (
              <p>O catálogo de planos ainda não foi definido pelo responsável do software.</p>
            )}
            <div className="account-records">
              {billing?.catalog.map((plan) => (
                <article key={plan.id}>
                  <div>
                    <h3>{plan.name}</h3>
                    <p>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: plan.currency,
                      }).format(plan.priceMinor / 100)}{" "}
                      / {plan.interval === "month" ? "mês" : "ano"}
                    </p>
                    <p>
                      {plan.members} membros · {plan.projects} projetos ·{" "}
                      {Math.round(plan.storageBytes / 1048576)} MB
                    </p>
                  </div>
                  {owner && (
                    <button
                      type="submit"
                      disabled={busy || (plan.priceMinor > 0 && !billing.configured)}
                      onClick={() => {
                        let requestId = sessionStorage.getItem(
                          `account-checkout:${session.organization.id}:${plan.id}`,
                        );
                        if (!requestId) {
                          requestId = crypto.randomUUID();
                          sessionStorage.setItem(
                            `account-checkout:${session.organization.id}:${plan.id}`,
                            requestId,
                          );
                        }
                        void act("/billing/checkout", { planId: plan.id, requestId });
                      }}
                    >
                      Escolher plano
                    </button>
                  )}
                </article>
              ))}
            </div>
            <p className="muted">As assinaturas de IA são independentes do plano La fabrique.</p>
          </section>
          <section className="panel">
            <h2>Uso da conta</h2>
            <p className="muted">
              Gestores veem o total da conta; demais membros veem apenas os projetos autorizados.
            </p>
            <dl className="account-metrics">
              {[
                ["Membros ativos", overview?.usage.activeMembers],
                ["Convites pendentes", overview?.usage.pendingInvitations],
                ["Projetos", overview?.usage.projects],
                ["Execuções", overview?.usage.executions],
                ["Aguardando aceite", overview?.usage.awaitingApproval],
                [
                  "Tempo com término confirmado",
                  overview?.usage.executionSeconds === null
                    ? "Não informado"
                    : `${overview?.usage.executionSeconds ?? 0} segundos${overview?.usage.executionTimeIncomplete ? " (parcial)" : ""}`,
                ],
                [
                  "Artefatos armazenados",
                  overview ? `${overview.usage.storageBytes} bytes` : undefined,
                ],
                [
                  "Tokens de entrada observados",
                  overview?.usage.aiUsage?.inputTokens ?? "Não informado pelo cliente",
                ],
                [
                  "Tokens de saída observados",
                  overview?.usage.aiUsage?.outputTokens ?? "Não informado pelo cliente",
                ],
              ].map(([title, value]) => (
                <div key={String(title)}>
                  <dt>{title}</dt>
                  <dd>{value ?? "Carregando"}</dd>
                </div>
              ))}
            </dl>
            {!!overview?.usage.aiUsage?.byProvider.length && (
              <ul>
                {overview.usage.aiUsage.byProvider.map((p) => (
                  <li key={p.provider}>
                    {p.provider}: {p.inputTokens ?? "desconhecidos"} tokens de entrada ·{" "}
                    {p.outputTokens ?? "desconhecidos"} de saída · {p.observations} observações
                    {p.incomplete ? " (parcial)" : ""}
                  </li>
                ))}
              </ul>
            )}
            {overview?.usage.aiUsage && (
              <p>
                Fonte: resultados persistidos de execução, observados em{" "}
                {new Date(overview.usage.aiUsage.observedAt).toLocaleString()}
                {overview.usage.aiUsage.incomplete
                  ? ". Alguns resultados não informam o consumo; os valores são parciais."
                  : "."}
              </p>
            )}
          </section>
          {owner && (
            <section className="panel">
              <h2>Faturas</h2>
              {billing?.invoices.length === 0 && <p>Nenhuma fatura registrada.</p>}
              {billing?.invoices.map((i) => (
                <article key={i.id}>
                  <p>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: i.currency,
                    }).format(i.amountMinor / 100)}{" "}
                    · {i.status}
                  </p>
                  {i.url && (
                    <a href={i.url} target="_blank" rel="noopener noreferrer">
                      Abrir fatura
                    </a>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}
      {mode === "notifications" && (
        <section className="panel">
          <h2>Notificações</h2>
          {notifications.length === 0 && <p>Nenhuma notificação no período de retenção.</p>}
          <div className="account-records">
            {notifications.map((n) => (
              <article key={n.id}>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <small>{new Date(n.createdAt).toLocaleString()}</small>
                </div>
                {!n.readAt && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(`/notifications/${n.id}/read`, undefined, "PATCH")}
                  >
                    Marcar como lida
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {mode === "data" && (
        <>
          <section className="panel">
            <h2>Exportar meus dados</h2>
            <p>
              Baixe seu perfil e os dados dos projetos a que você tem acesso. Credenciais e tokens
              não entram no arquivo.
            </p>
            <button type="button" disabled={busy} onClick={() => void exportData()}>
              Baixar exportação JSON
            </button>
          </section>
          {owner && billing && (
            <>
              <section className="panel">
                <h2>Dados fiscais e retenção</h2>
                <form
                  key={billing.version}
                  onSubmit={(e) =>
                    submit(e, "/data/settings", (d) => ({
                      expectedVersion: billing.version,
                      retentionDays: Number(d.get("retentionDays")),
                      billing: {
                        legalName: String(d.get("legalName")),
                        taxId: String(d.get("taxId")),
                        address: String(d.get("address")),
                        country: String(d.get("country")),
                        billingEmail: String(d.get("billingEmail")),
                      },
                    }))
                  }
                >
                  <fieldset disabled={busy} className="account-form">
                    {(
                      [
                        ["legalName", "Nome ou razão social"],
                        ["taxId", "Identificação fiscal"],
                        ["address", "Endereço"],
                        ["country", "País (duas letras)"],
                        ["billingEmail", "Email de cobrança"],
                      ] as const
                    ).map(([name, label]) => (
                      <label key={name}>
                        {label}
                        <input
                          name={name}
                          type={name === "billingEmail" ? "email" : "text"}
                          required={name === "country" || name === "billingEmail"}
                          maxLength={name === "country" ? 2 : 500}
                          defaultValue={
                            name in billing.billing
                              ? String(billing.billing[name as keyof typeof billing.billing])
                              : name === "billingEmail"
                                ? session.user.email
                                : ""
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Retenção de notificações (dias)
                      <input
                        name="retentionDays"
                        type="number"
                        min={7}
                        max={3650}
                        defaultValue={billing.retentionDays}
                        required
                      />
                    </label>
                    <p>
                      Notificações lidas anteriores ao prazo são removidas ao salvar. Evidências de
                      execução e auditoria são preservadas.
                    </p>
                    <button type="submit">Salvar dados</button>
                  </fieldset>
                </form>
              </section>
              <section className="panel">
                <h2>Transferir titularidade</h2>
                <form
                  onSubmit={(e) =>
                    submit(e, "/ownership/transfer", (d) => ({
                      ...sensitive(d),
                      membershipId: String(d.get("membershipId")),
                    }))
                  }
                >
                  <fieldset disabled={busy} className="account-form">
                    <label>
                      Novo proprietário
                      <select name="membershipId" required>
                        {overview?.members
                          .filter((m) => m.userId !== session.user.id && m.status === "ACTIVE")
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.email}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Senha atual
                      <input
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </label>
                    <FactorFields />
                    <button type="submit">Enviar solicitação para aceite</button>
                  </fieldset>
                </form>
                <p>
                  O destinatário precisa ter email verificado e aceitar a transferência em até 24
                  horas.
                </p>
              </section>
              <section className="panel">
                <h2>Encerrar conta</h2>
                <form onSubmit={(e) => submit(e, "/archive", (d) => sensitive(d))}>
                  <fieldset disabled={busy} className="account-form">
                    <p>
                      O encerramento desativa o acesso desta conta. Cancele a assinatura e conclua
                      as execuções primeiro. Evidências históricas são preservadas.
                    </p>
                    <label>
                      Senha atual
                      <input
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </label>
                    <FactorFields />
                    <label className="account-check">
                      <input type="checkbox" required />
                      Confirmo o encerramento desta conta
                    </label>
                    <button type="submit">Encerrar conta</button>
                  </fieldset>
                </form>
              </section>
            </>
          )}
          {transferToken && (
            <section className="panel">
              <h2>Aceitar titularidade</h2>
              <form
                onSubmit={(e) =>
                  submit(e, "/ownership/accept", (d) => ({ ...sensitive(d), token: transferToken }))
                }
              >
                <fieldset disabled={busy} className="account-form">
                  <label>
                    Senha atual
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <FactorFields />
                  <button type="submit">Aceitar transferência</button>
                </fieldset>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}
