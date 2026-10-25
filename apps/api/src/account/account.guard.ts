import {
  type CanActivate,
  ConflictException,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type AccountPrincipal, AccountService } from "./account.service";
import { assertCsrf, readSessionCookie } from "./account-security";

export type AccountRequest = {
  headers: {
    cookie?: string;
    origin?: string;
    host?: string;
    "x-account-csrf"?: string;
    "x-account-request"?: string;
    "x-account-organization"?: string;
  };
  method: string;
  socket: { remoteAddress?: string };
  principal?: AccountPrincipal;
};
export function assertAccountOrigin(request: AccountRequest, configuredOrigin?: string): void {
  if (request.headers["x-account-request"] !== "1")
    throw new ForbiddenException("Requisição de conta inválida.");
  const origin = request.headers.origin;
  if (!origin) return;
  try {
    const url = new URL(origin);
    if (
      configuredOrigin
        ? url.origin === new URL(configuredOrigin).origin
        : ["http:", "https:"].includes(url.protocol) && url.host === request.headers.host
    )
      return;
  } catch {
    /* Invalid and cross-origin requests are rejected. */
  }
  throw new ForbiddenException("Origem não autorizada.");
}
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(
    @Inject(AccountService) private readonly accounts: AccountService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    context
      .switchToHttp()
      .getResponse<{ setHeader(n: string, v: string): void }>()
      .setHeader("Cache-Control", "no-store");
    assertAccountOrigin(request, this.config.get<string>("WEB_ORIGIN"));
    request.principal = await this.accounts.authenticate(readSessionCookie(request.headers.cookie));
    if (
      request.headers["x-account-organization"] &&
      request.headers["x-account-organization"] !== request.principal.session.organizationId
    )
      throw new ConflictException("A conta ativa mudou. Atualize antes de continuar.");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      assertCsrf(request.principal.session.csrfToken, request.headers["x-account-csrf"]);
      if (request.headers["x-account-organization"] !== request.principal.session.organizationId)
        throw new ConflictException("A conta ativa mudou. Atualize antes de salvar.");
    }
    return true;
  }
}
