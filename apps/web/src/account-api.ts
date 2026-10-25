import {
  type AccountLogin,
  type AccountRegister,
  type AccountSession,
  accountInviteResultSchema,
  accountOverviewSchema,
  accountSessionSchema,
  accountSessionsSchema,
} from "@le-fabrique/contracts";

const apiUrl = import.meta.env.VITE_API_URL ?? "/api";
export class AccountApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function accountRequest(
  path: string,
  session?: AccountSession | null,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`${apiUrl}/account${path}`, {
    method,
    credentials: "include",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Account-Request": "1",
      ...(session
        ? { "X-Account-CSRF": session.csrfToken, "X-Account-Organization": session.organization.id }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new AccountApiError(
      typeof payload?.message === "string"
        ? payload.message
        : "Não foi possível concluir a operação.",
      response.status,
    );
  }
  return response.json();
}
export const getAccountSession = async (signal?: AbortSignal) =>
  accountSessionSchema.parse(await accountRequest("/session", undefined, "GET", undefined, signal));
export const getAccountOverview = async (session: AccountSession, signal?: AbortSignal) =>
  accountOverviewSchema.parse(await accountRequest("/overview", session, "GET", undefined, signal));
export const getAccountSessions = async (session: AccountSession, signal?: AbortSignal) =>
  accountSessionsSchema.parse(await accountRequest("/sessions", session, "GET", undefined, signal));
export const registerAccount = async (input: AccountRegister) =>
  accountSessionSchema.parse(await accountRequest("/register", undefined, "POST", input));
export const loginAccount = async (input: AccountLogin) =>
  accountSessionSchema.parse(await accountRequest("/login", undefined, "POST", input));
export const createAccountInvitation = async (session: AccountSession, input: unknown) =>
  accountInviteResultSchema.parse(await accountRequest("/invitations", session, "POST", input));
