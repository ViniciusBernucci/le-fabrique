import type { AccountSession } from "@le-fabrique/contracts";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { accountRequest } from "./account-api";
export function FactorFields() {
  return (
    <>
      <label>
        Código do autenticador (se ativo)
        <input
          name="otp"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
        />
      </label>
      <label>
        Ou código de recuperação
        <input name="recoveryCode" maxLength={16} autoComplete="off" />
      </label>
    </>
  );
}
export function factors(data: FormData) {
  return {
    ...(data.get("otp") ? { otp: String(data.get("otp")) } : {}),
    ...(data.get("recoveryCode") ? { recoveryCode: String(data.get("recoveryCode")) } : {}),
  };
}
export function sensitive(data: FormData) {
  return { password: String(data.get("password")), ...factors(data) };
}
export function AccountSecurityExtras({
  session,
  refresh,
}: {
  session: AccountSession;
  refresh: () => Promise<void>;
}) {
  const [pending, setPending] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await accountRequest(
        path,
        session,
        "POST",
        path === "/mfa/confirm"
          ? { otp: String(data.get("otp")) }
          : path === "/email/change"
            ? { ...sensitive(data), email: String(data.get("email")) }
            : sensitive(data),
      );
      if (path === "/mfa/prepare")
        setPending(z.object({ secret: z.string(), uri: z.string() }).parse(response));
      else if (path === "/mfa/confirm") {
        setCodes(z.object({ recoveryCodes: z.array(z.string()) }).parse(response).recoveryCodes);
        setPending(null);
        await refresh();
      } else {
        await refresh();
        setMessage(
          path === "/email/change"
            ? "Envio solicitado. Confirme a mensagem quando ela chegar ao novo email."
            : "Segundo fator desativado.",
        );
      }
      form.reset();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Email e recuperação de acesso</h2>
        <p>
          {session.user.emailVerified ? "Email verificado" : "Seu email ainda não foi verificado"}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void accountRequest("/email/verification", session, "POST")
              .then(() =>
                setMessage("Envio de confirmação solicitado. Confira sua caixa de entrada."),
              )
              .catch((e) => setMessage(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Enviar confirmação de email
        </button>
        <form onSubmit={(e) => void submit(e, "/email/change")}>
          <fieldset disabled={busy} className="account-form">
            <label>
              Novo email
              <input name="email" type="email" required maxLength={254} />
            </label>
            <label>
              Senha atual
              <input
                name="password"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <FactorFields />
            <button type="submit">Solicitar alteração de email</button>
          </fieldset>
        </form>
      </section>
      <section className="panel">
        <h2>Autenticação em dois fatores</h2>
        <p>
          {session.user.mfaEnabled
            ? "Ativa: use seu autenticador para entrar e confirmar ações sensíveis."
            : "Proteja sua conta com um aplicativo autenticador."}
        </p>
        {!pending && (
          <form
            onSubmit={(e) =>
              void submit(e, session.user.mfaEnabled ? "/mfa/disable" : "/mfa/prepare")
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
                  maxLength={128}
                />
              </label>
              {session.user.mfaEnabled && <FactorFields />}
              <button type="submit">
                {session.user.mfaEnabled ? "Desativar segundo fator" : "Configurar autenticador"}
              </button>
            </fieldset>
          </form>
        )}
        {pending && (
          <>
            <label>
              Chave para adicionar ao autenticador
              <input value={pending.secret} readOnly autoComplete="off" />
            </label>
            <form onSubmit={(e) => void submit(e, "/mfa/confirm")}>
              <fieldset disabled={busy}>
                <label>
                  Código gerado pelo autenticador
                  <input
                    name="otp"
                    required
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
                <button type="submit">Confirmar e ativar</button>
              </fieldset>
            </form>
            <button type="button" className="secondary-action" onClick={() => setPending(null)}>
              Cancelar configuração
            </button>
          </>
        )}
        {!!codes.length && (
          <div role="status">
            <p>
              Guarde estes códigos em um local privado. Cada um funciona uma vez e esta lista não
              será exibida novamente.
            </p>
            <pre>{codes.join("\n")}</pre>
            <button type="button" onClick={() => setCodes([])}>
              Já guardei os códigos
            </button>
          </div>
        )}
      </section>
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function AccountRecovery({ kind, token }: { kind: string; token: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel account-auth">
      <h2>
        {kind === "verify"
          ? "Confirmar email"
          : kind === "reset"
            ? "Redefinir senha"
            : "Recuperar acesso"}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          setBusy(true);
          const input =
            kind === "verify"
              ? { token }
              : kind === "reset"
                ? { token, password: String(data.get("password")), ...factors(data) }
                : { email: String(data.get("email")) };
          void accountRequest(`/${kind}`, null, "POST", input)
            .then(() => {
              setMessage(
                kind === "recover"
                  ? "Se este email estiver verificado, você receberá um link para recuperar o acesso."
                  : "Operação concluída. Entre na sua conta para continuar.",
              );
              form.reset();
            })
            .catch((err) => setMessage(err.message))
            .finally(() => setBusy(false));
        }}
      >
        <fieldset disabled={busy} className="account-form">
          {kind === "recover" && (
            <label>
              Email
              <input name="email" type="email" required />
            </label>
          )}
          {kind === "reset" && (
            <>
              <label>
                Nova senha
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                />
              </label>
              <FactorFields />
            </>
          )}
          <button type="submit">
            {kind === "verify"
              ? "Confirmar email"
              : kind === "reset"
                ? "Salvar nova senha"
                : "Enviar link de recuperação"}
          </button>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
