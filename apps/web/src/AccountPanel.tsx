import type {
  AccountOverview,
  AccountRole,
  AccountSession,
  AccountSessions,
} from "@le-fabrique/contracts";
import { type FormEvent, useEffect, useState } from "react";
import { AccountDataPanel } from "./AccountDataPanel";
import { AccountIntegrations } from "./AccountIntegrations";
import { AccountProjects } from "./AccountProjects";
import {
  AccountRecovery,
  AccountSecurityExtras,
  FactorFields,
  factors,
} from "./AccountSecurityExtras";
import {
  AccountApiError,
  accountRequest,
  createAccountInvitation,
  getAccountOverview,
  getAccountSession,
  getAccountSessions,
  loginAccount,
  registerAccount,
} from "./account-api";
import { HudSystemMessage } from "./HudSystemMessage";
import "./account.css";

type Tab =
  | "profile"
  | "organization"
  | "members"
  | "security"
  | "plan"
  | "activity"
  | "projects"
  | "integrations"
  | "data"
  | "notifications";
const tabs: { id: Tab; title: string }[] = [
  { id: "profile", title: "Meu perfil" },
  { id: "organization", title: "Minha conta" },
  { id: "members", title: "Pessoas e acesso" },
  { id: "security", title: "Segurança" },
  { id: "plan", title: "Plano e uso" },
  { id: "activity", title: "Atividade" },
  { id: "projects", title: "Projetos e execuções" },
  { id: "integrations", title: "Integrações" },
  { id: "notifications", title: "Notificações" },
  { id: "data", title: "Meus dados" },
];
const roles: Record<AccountRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador da conta",
  OPERATOR: "Operador",
  APPROVER: "Aprovador",
  READER: "Leitor",
};
const statuses = { ACTIVE: "Ativo", SUSPENDED: "Suspenso", REMOVED: "Removido" };
const actions: Record<string, string> = {
  ACCOUNT_CREATED: "Criou a conta",
  SIGNED_IN: "Entrou na conta",
  PROFILE_UPDATED: "Atualizou o perfil",
  ORGANIZATION_UPDATED: "Atualizou os dados da conta",
  ACCOUNT_SELECTED: "Selecionou a conta",
  INVITATION_CREATED: "Criou um convite",
  INVITATION_REVOKED: "Revogou um convite",
  INVITATION_ACCEPTED: "Aceitou um convite",
  MEMBER_UPDATED: "Atualizou um acesso",
  SESSION_REVOKED: "Encerrou uma sessão",
  PASSWORD_CHANGED: "Alterou a senha",
  PROJECT_CREATED: "Criou um projeto",
  PROJECT_GRANT_CHANGED: "Atualizou acesso ao projeto",
  PROJECT_DEFINITION_UPDATED: "Atualizou a definição do projeto",
  PROJECT_BASE_UPDATED: "Atualizou a revisão inicial",
  PROJECT_AGENTS_UPDATED: "Atualizou agentes do projeto",
  TICKET_CREATED: "Criou um trabalho",
  TICKET_EXECUTION_REQUESTED: "Solicitou execução",
  RUN_DELIVERY_ACCEPTED: "Aceitou uma entrega",
  RUN_PAUSE_REQUESTED: "Solicitou pausa",
  RUN_CANCEL_REQUESTED: "Solicitou cancelamento",
  RUN_RESUME_REQUESTED: "Solicitou retomada",
  RUN_RECOVERY_REQUESTED: "Solicitou recuperação",
  INTEGRATION_CREATED: "Cadastrou integração",
  INTEGRATION_UPDATED: "Atualizou integração",
  INTEGRATION_GRANT_CHANGED: "Atualizou autorização de integração",
  GITHUB_CONNECTION_VERIFIED: "Verificou conexão GitHub",
  OWNERSHIP_TRANSFER_REQUESTED: "Solicitou transferência de titularidade",
  OWNERSHIP_TRANSFERRED: "Aceitou titularidade",
  DATA_SETTINGS_UPDATED: "Atualizou dados e retenção",
  SUBSCRIPTION_SYNCHRONIZED: "Atualizou situação da assinatura",
  MFA_ENABLED: "Ativou segundo fator",
  MFA_DISABLED: "Desativou segundo fator",
  EMAIL_CHANGE_REQUESTED: "Solicitou alteração de email",
  EMAIL_VERIFICATION_REQUESTED: "Solicitou confirmação de email",
  PROVIDER_LOGIN_REQUESTED: "Solicitou login da integração",
  PROVIDER_VERIFICATION_REQUESTED: "Solicitou verificação da integração",
  PROVIDER_AUTHORIZATION_SUBMITTED: "Enviou confirmação de autorização",
};
export function captureAccountInvite(): string {
  if (typeof window === "undefined") return "";
  const match = /^#account-invite=([a-f0-9]{64})$/.exec(window.location.hash);
  if (!match) return "";
  const token = match[1] ?? "";
  return token;
}
export function AccountPanel({ initialTab = "profile" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [sessions, setSessions] = useState<AccountSessions>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [invitationToken, setInvitationToken] = useState(captureAccountInvite);
  const [invitationLink, setInvitationLink] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [recovery, setRecovery] = useState(() => {
    const m = /^#account-(verify|reset|transfer)=([a-f0-9]{64})$/.exec(window.location.hash);
    return m ? { kind: m[1] ?? "", token: m[2] ?? "" } : null;
  });
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (recovery?.kind === "transfer") setTab("data");
    if (recovery)
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [recovery]);
  const canManage =
    session?.organization.role === "OWNER" || session?.organization.role === "ADMIN";
  const isOwner = session?.organization.role === "OWNER";

  useEffect(() => {
    if (invitationToken && /^#account-invite=/.test(window.location.hash))
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [invitationToken]);
  useEffect(() => {
    setTab(
      recovery?.kind === "transfer"
        ? "data"
        : /^#account-billing=/.test(window.location.hash)
          ? "plan"
          : initialTab,
    );
    if (/^#account-billing=/.test(window.location.hash))
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [initialTab, recovery]);
  useEffect(() => {
    const controller = new AbortController();
    void getAccountSession(controller.signal)
      .then(async (current) => {
        const [data, activeSessions] = await Promise.all([
          getAccountOverview(current, controller.signal),
          getAccountSessions(current, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setSession(current);
          setOverview(data);
          setSessions(activeSessions);
        }
      })
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof AccountApiError && error.status === 401)
        ) {
          setLoadError(true);
          setMessage(error instanceof Error ? error.message : "Falha ao carregar a conta.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function refresh() {
    const current = await getAccountSession();
    const [data, activeSessions] = await Promise.all([
      getAccountOverview(current),
      getAccountSessions(current),
    ]);
    setSession(current);
    setOverview(data);
    setSessions(activeSessions);
    setFormVersion((value) => value + 1);
    setLoadError(false);
  }
  async function perform(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
      return true;
    } catch (error) {
      if (error instanceof AccountApiError && error.status === 401) {
        setSession(null);
        setOverview(null);
        setSessions([]);
        setInvitationLink("");
      }
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const success = await perform(
      async () => {
        const input = { email: String(data.get("email")), password: String(data.get("password")) };
        if (registering)
          await registerAccount({
            ...input,
            name: String(data.get("name")),
            organizationName: String(data.get("organizationName")),
          });
        else await loginAccount({ ...input, ...factors(data) });
        await refresh();
      },
      registering ? "Conta criada. Bem-vindo!" : "Você entrou na sua conta.",
    );
    if (success) form.reset();
  }
  async function mutate(
    path: string,
    method: string,
    input?: unknown,
    success = "Alterações salvas.",
  ) {
    if (!session) return false;
    return perform(async () => {
      await accountRequest(path, session, method, input);
      setInvitationLink("");
      await refresh();
    }, success);
  }
  const formatDate = (date: string) =>
    new Date(date).toLocaleString(session?.user.preferences.locale ?? "pt-BR", {
      timeZone: session?.user.preferences.timeZone ?? "Europe/Berlin",
    });

  if (recovery && recovery.kind !== "transfer")
    return (
      <main className="account-shell">
        <AccountRecovery kind={recovery.kind} token={recovery.token} />
        <button type="button" onClick={() => setRecovery(null)}>
          Voltar à conta
        </button>
      </main>
    );
  if (loading)
    return (
      <main className="shell account-shell">
        <p role="status">Carregando sua conta…</p>
      </main>
    );
  if (!session)
    return (
      <main className="shell account-shell">
        <section className="panel account-auth">
          <p className="eyebrow">Sua conta La fabrique</p>
          <h1>{registering ? "Criar minha conta" : "Entrar na minha conta"}</h1>
          <p className="muted">Gerencie seu perfil, sua equipe e o acesso à sua conta.</p>
          {invitationToken && (
            <p className="account-notice">
              Você recebeu um convite. Entre ou cadastre-se com o email que foi convidado para
              aceitá-lo.
            </p>
          )}
          <HudSystemMessage message={message} />
          {loadError ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void perform(refresh, "Conta recarregada.")}
            >
              Tentar novamente
            </button>
          ) : (
            <form onSubmit={signIn}>
              <fieldset disabled={busy}>
                {registering && (
                  <>
                    <label>
                      Seu nome
                      <input name="name" autoComplete="name" maxLength={100} required />
                    </label>
                    <label>
                      Nome da sua conta ou equipe
                      <input name="organizationName" maxLength={100} required />
                    </label>
                  </>
                )}
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    maxLength={254}
                    required
                  />
                </label>
                <label>
                  Senha
                  <input
                    name="password"
                    type="password"
                    autoComplete={registering ? "new-password" : "current-password"}
                    minLength={registering ? 12 : 1}
                    maxLength={128}
                    required
                  />
                </label>
                {registering && (
                  <p className="muted">
                    Use uma senha com pelo menos 12 caracteres. Confirme seu email na aba Segurança
                    após criar a conta.
                  </p>
                )}
                {!registering && <FactorFields />}
                <button type="submit">
                  {busy ? "Aguarde…" : registering ? "Criar conta" : "Entrar"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setRegistering((value) => !value);
                    setMessage("");
                  }}
                >
                  {registering ? "Já tenho uma conta" : "Criar minha conta"}
                </button>
              </fieldset>
            </form>
          )}
          <button
            type="button"
            className="secondary-action"
            onClick={() => setRecovery({ kind: "recover", token: "" })}
          >
            Esqueci minha senha
          </button>
        </section>
      </main>
    );
  return (
    <main className="shell account-shell">
      <header className="account-heading">
        <div>
          <p className="eyebrow">Administração da sua conta</p>
          <h1>{session.organization.name}</h1>
          <p className="muted">
            {session.user.name} · {roles[session.organization.role]}
          </p>
        </div>
        <div className="account-actions">
          {session.organizations.length > 1 && (
            <label>
              Conta ativa
              <select
                value={session.organization.id}
                disabled={busy}
                onChange={(event) =>
                  void mutate(
                    "/session/organization",
                    "PUT",
                    { organizationId: event.target.value },
                    "Conta selecionada.",
                  )
                }
              >
                {session.organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="secondary-action"
            disabled={busy}
            onClick={() => void perform(refresh, "Dados atualizados.")}
          >
            Atualizar
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await accountRequest("/logout", session, "POST");
                setSession(null);
                setOverview(null);
                setSessions([]);
                setInvitationLink("");
              }, "Você saiu da conta.")
            }
          >
            Sair
          </button>
        </div>
      </header>
      <HudSystemMessage message={message} />
      {invitationToken && (
        <section className="panel account-notice">
          <h2>Convite recebido</h2>
          <p>
            Ao aceitar, você entra na conta que enviou este convite, usando seu email{" "}
            {session.user.email}.
          </p>
          <div className="account-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void mutate(
                  "/invitations/accept",
                  "POST",
                  { token: invitationToken },
                  "Convite aceito.",
                ).then((ok) => {
                  if (ok) setInvitationToken("");
                })
              }
            >
              Aceitar convite
            </button>
            <button
              type="button"
              disabled={busy}
              className="secondary-action"
              onClick={() => setInvitationToken("")}
            >
              Descartar convite
            </button>
          </div>
        </section>
      )}
      <nav className="account-tabs" aria-label="Configurações da minha conta">
        {tabs
          .filter((item) => item.id !== "integrations" || canManage)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => {
                setTab(item.id);
                setFormVersion((value) => value + 1);
              }}
              disabled={busy}
            >
              {item.title}
            </button>
          ))}
      </nav>
      {tab === "profile" && (
        <section className="panel">
          <h2>Meu perfil</h2>
          <form
            key={`profile:${formVersion}`}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void mutate("/profile", "PUT", {
                ...(avatar !== undefined ? { avatarDataUrl: avatar } : {}),
                expectedVersion: session.user.version,
                name: String(data.get("name")),
                preferences: {
                  locale: String(data.get("locale")),
                  timeZone: String(data.get("timeZone")),
                  deliveryNotifications: data.get("deliveryNotifications") === "on",
                  executionNotifications: data.get("executionNotifications") === "on",
                },
              });
            }}
          >
            <fieldset disabled={busy} className="account-form">
              {(avatar !== undefined ? avatar : session.user.avatarDataUrl) && (
                <img
                  className="account-avatar"
                  src={(avatar !== undefined ? avatar : session.user.avatarDataUrl) ?? undefined}
                  alt="Minha foto"
                />
              )}
              <label>
                Foto de perfil
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2000000) {
                      setMessage("Escolha uma imagem de até 2 MB.");
                      return;
                    }
                    const url = URL.createObjectURL(file);
                    const picture = new Image();
                    picture.onload = () => {
                      const canvas = document.createElement("canvas");
                      canvas.width = 128;
                      canvas.height = 128;
                      const context = canvas.getContext("2d");
                      if (context) {
                        const edge = Math.min(picture.width, picture.height);
                        context.drawImage(
                          picture,
                          (picture.width - edge) / 2,
                          (picture.height - edge) / 2,
                          edge,
                          edge,
                          0,
                          0,
                          128,
                          128,
                        );
                        const encoded = canvas.toDataURL("image/jpeg", 0.7);
                        if (encoded.length <= 24000) setAvatar(encoded);
                        else setMessage("A imagem excedeu o limite. Use uma foto menor.");
                      }
                      URL.revokeObjectURL(url);
                    };
                    picture.onerror = () => {
                      URL.revokeObjectURL(url);
                      setMessage("Imagem inválida.");
                    };
                    picture.src = url;
                  }}
                />
              </label>
              <button type="button" className="secondary-action" onClick={() => setAvatar(null)}>
                Remover foto
              </button>
              <label>
                Nome
                <input name="name" defaultValue={session.user.name} maxLength={100} required />
              </label>
              <label>
                Email
                <input value={session.user.email} type="email" readOnly />
                <small>
                  {session.user.emailVerified ? "Email verificado" : "Email não verificado"}.
                  Gerencie seu email na aba Segurança.
                </small>
              </label>
              <label>
                Idioma
                <select name="locale" defaultValue={session.user.preferences.locale}>
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (United States)</option>
                </select>
              </label>
              <label>
                Fuso horário
                <input
                  name="timeZone"
                  defaultValue={session.user.preferences.timeZone}
                  list="account-timezones"
                  maxLength={100}
                  required
                />
                <datalist id="account-timezones">
                  {["Europe/Berlin", "America/Sao_Paulo", "America/New_York", "UTC"].map(
                    (value) => (
                      <option key={value} value={value} />
                    ),
                  )}
                </datalist>
              </label>
              <label className="account-check">
                <input
                  type="checkbox"
                  name="deliveryNotifications"
                  defaultChecked={session.user.preferences.deliveryNotifications}
                />
                Avisos de entregas
              </label>
              <label className="account-check">
                <input
                  type="checkbox"
                  name="executionNotifications"
                  defaultChecked={session.user.preferences.executionNotifications}
                />
                Avisos de execuções
              </label>
              <p className="muted">
                Seus avisos de execução e entrega aparecem na aba Notificações.
              </p>
              <div className="account-actions">
                <button type="submit">Salvar perfil</button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setAvatar(undefined);
                    setFormVersion((value) => value + 1);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      {tab === "organization" && (
        <section className="panel">
          <h2>Dados da conta</h2>
          <p className="muted">
            A conta reúne as pessoas da sua equipe. Seu perfil pessoal continua independente.
          </p>
          <form
            key={`organization:${formVersion}`}
            onSubmit={(event) => {
              event.preventDefault();
              void mutate("/organization", "PUT", {
                expectedVersion: session.organization.version,
                name: String(new FormData(event.currentTarget).get("name")),
              });
            }}
          >
            <fieldset disabled={busy || !canManage} className="account-form">
              <label>
                Nome da conta
                <input
                  name="name"
                  defaultValue={session.organization.name}
                  maxLength={100}
                  required
                />
              </label>
              <div className="account-actions">
                <button type="submit">Salvar conta</button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setFormVersion((value) => value + 1)}
                >
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
          {!canManage && (
            <p className="muted">Somente o proprietário ou administrador pode editar a conta.</p>
          )}
        </section>
      )}
      {tab === "members" && (
        <>
          {canManage && (
            <section className="panel">
              <h2>Convidar uma pessoa</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void perform(async () => {
                    const result = await createAccountInvitation(session, {
                      email: String(data.get("email")),
                      role: String(data.get("role")),
                    });
                    setInvitationLink(
                      `${window.location.origin}${window.location.pathname}#account-invite=${result.token}`,
                    );
                    await refresh();
                    form.reset();
                  }, "Convite criado. Compartilhe o link em particular com a pessoa convidada.");
                }}
              >
                <fieldset disabled={busy} className="account-form">
                  <label>
                    Email da pessoa
                    <input name="email" type="email" maxLength={254} required />
                  </label>
                  <label>
                    Papel
                    <select name="role" defaultValue="READER">
                      {Object.entries(roles)
                        .filter(([role]) => role !== "OWNER" && (isOwner || role !== "ADMIN"))
                        .map(([role, label]) => (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button type="submit">Criar convite</button>
                </fieldset>
              </form>
              <p className="muted">
                O link vale por 72 horas e pode ser usado uma vez, pela conta com o email convidado.
                Quando o envio de email está configurado, a pessoa recebe também o convite por
                email. O email precisa ser verificado antes do aceite.
              </p>
              {invitationLink && (
                <label>
                  Link privado do convite
                  <input
                    value={invitationLink}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <small>
                    Copie este link agora; ele não aparece novamente ao atualizar a página.
                  </small>
                </label>
              )}
            </section>
          )}
          <section className="panel">
            <h2>Pessoas da conta</h2>
            <p className="muted">
              Pessoas são membros humanos; agentes de IA são configurados separadamente. Defina o
              acesso de cada pessoa na aba Projetos e execuções.
            </p>
            <div className="account-records">
              {overview?.members.map((member) => {
                const manageable =
                  canManage && member.role !== "OWNER" && (isOwner || member.role !== "ADMIN");
                return (
                  <article key={`${member.id}:${member.version}`}>
                    <div>
                      <h3>{member.name}</h3>
                      <p>{member.email}</p>
                      <span className="badge">
                        {roles[member.role]} · {statuses[member.status]}
                      </span>
                    </div>
                    {manageable && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void mutate(
                            `/members/${member.id}`,
                            "PATCH",
                            {
                              expectedVersion: member.version,
                              role: String(data.get("role")),
                              status: String(data.get("status")),
                            },
                            "Acesso atualizado.",
                          );
                        }}
                      >
                        <fieldset disabled={busy} className="account-member-form">
                          <label>
                            Papel de {member.name}
                            <select name="role" defaultValue={member.role}>
                              {Object.entries(roles)
                                .filter(
                                  ([role]) => role !== "OWNER" && (isOwner || role !== "ADMIN"),
                                )
                                .map(([role, label]) => (
                                  <option key={role} value={role}>
                                    {label}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            Acesso de {member.name}
                            <select name="status" defaultValue={member.status}>
                              {Object.entries(statuses).map(([status, label]) => (
                                <option key={status} value={status}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="submit">Salvar acesso</button>
                        </fieldset>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
            {!canManage && (
              <p className="muted">
                Você pode consultar seu próprio vínculo. A lista da equipe é reservada aos
                administradores da conta.
              </p>
            )}
          </section>
          {canManage && (
            <section className="panel">
              <h2>Convites</h2>
              {!overview?.invitations.length && <p className="muted">Nenhum convite enviado.</p>}
              <div className="account-records">
                {overview?.invitations.map((invite) => (
                  <article key={invite.id}>
                    <div>
                      <h3>{invite.email}</h3>
                      <p>
                        {roles[invite.role]} ·{" "}
                        {
                          {
                            PENDING: "Pendente",
                            ACCEPTED: "Aceito",
                            REVOKED: "Revogado",
                            EXPIRED: "Expirado",
                          }[invite.status]
                        }
                      </p>
                      <small>Validade: {formatDate(invite.expiresAt)}</small>
                    </div>
                    {invite.status === "PENDING" && (isOwner || invite.role !== "ADMIN") && (
                      <button
                        type="button"
                        className="secondary-action"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            `/invitations/${invite.id}`,
                            "DELETE",
                            undefined,
                            "Convite revogado.",
                          )
                        }
                      >
                        Revogar convite
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {tab === "security" && (
        <>
          <AccountSecurityExtras
            key={session.organization.id}
            session={session}
            refresh={refresh}
          />
          <section className="panel">
            <h2>Alterar senha</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void mutate(
                  "/password",
                  "PUT",
                  {
                    currentPassword: String(data.get("currentPassword")),
                    newPassword: String(data.get("newPassword")),
                    ...factors(data),
                  },
                  "Senha alterada; as outras sessões foram encerradas.",
                ).then((ok) => {
                  if (ok) form.reset();
                });
              }}
            >
              <fieldset disabled={busy} className="account-form">
                <label>
                  Senha atual
                  <input
                    type="password"
                    name="currentPassword"
                    autoComplete="current-password"
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Nova senha
                  <input
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <FactorFields />
                <button type="submit">Alterar senha</button>
              </fieldset>
            </form>
          </section>
          <section className="panel">
            <h2>Sessões conectadas</h2>
            <div className="account-records">
              {sessions.map((item) => (
                <article key={item.id}>
                  <div>
                    <h3>{item.current ? "Esta sessão" : "Outra sessão"}</h3>
                    <p>Iniciada em {formatDate(item.createdAt)}</p>
                    <small>Expira em {formatDate(item.expiresAt)}</small>
                  </div>
                  {!item.current && (
                    <button
                      type="button"
                      disabled={busy}
                      className="secondary-action"
                      onClick={() =>
                        void mutate(
                          `/sessions/${item.id}`,
                          "DELETE",
                          undefined,
                          "Sessão encerrada.",
                        )
                      }
                    >
                      Encerrar sessão
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === "plan" && (
        <AccountDataPanel
          key={session.organization.id}
          session={session}
          overview={overview}
          refresh={refresh}
          mode="plan"
        />
      )}
      {tab === "data" && (
        <AccountDataPanel
          key={session.organization.id}
          session={session}
          overview={overview}
          refresh={refresh}
          mode="data"
          transferToken={recovery?.kind === "transfer" ? recovery.token : ""}
        />
      )}
      {tab === "notifications" && (
        <AccountDataPanel
          key={session.organization.id}
          session={session}
          overview={overview}
          refresh={refresh}
          mode="notifications"
        />
      )}
      {tab === "integrations" && (
        <AccountIntegrations key={session.organization.id} session={session} />
      )}
      {tab === "projects" && (
        <AccountProjects key={session.organization.id} session={session} overview={overview} />
      )}
      {tab === "activity" && (
        <section className="panel">
          <h2>Atividade da conta</h2>
          {!canManage ? (
            <p className="muted">
              O histórico da equipe é reservado ao proprietário e aos administradores.
            </p>
          ) : (
            <>
              <p className="muted">Últimas 50 ações da sua conta.</p>
              <div className="account-records">
                {overview?.audit.map((item) => (
                  <article key={item.id}>
                    <div>
                      <h3>{actions[item.action] ?? "Ação da conta"}</h3>
                      <p>{item.actorName}</p>
                    </div>
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </article>
                ))}
              </div>
              {!overview?.audit.length && <p className="muted">Nenhuma atividade registrada.</p>}
            </>
          )}
        </section>
      )}
    </main>
  );
}
