import {
  accountAcceptInviteSchema,
  accountInviteResultSchema,
  accountInviteSchema,
  accountLoginSchema,
  accountMemberUpdateSchema,
  accountOrganizationUpdateSchema,
  accountOverviewSchema,
  accountPasswordUpdateSchema,
  accountProfileUpdateSchema,
  accountRegisterSchema,
  accountSessionSchema,
  accountSessionsSchema,
  accountSwitchSchema,
} from "@le-fabrique/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { z } from "zod";
import { AccountGuard, type AccountRequest, assertAccountOrigin } from "./account.guard";
import { type AccountPrincipal, AccountService } from "./account.service";
import { AccountExceptionFilter } from "./account-exception.filter";
import { ACCOUNT_COOKIE, SESSION_SECONDS } from "./account-security";

type Response = { setHeader(name: string, value: string): void };
function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("Revise os campos informados.");
  return result.data;
}
function principal(request: AccountRequest): AccountPrincipal {
  if (!request.principal) throw new Error("AccountGuard required");
  return request.principal;
}
function privateResponse(response: Response): void {
  response.setHeader("Cache-Control", "no-store");
}
function cookie(response: Response, token: string, production: boolean): void {
  response.setHeader(
    "Set-Cookie",
    `${ACCOUNT_COOKIE}=${token}; Path=/api/account; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}${production ? "; Secure" : ""}`,
  );
  privateResponse(response);
}
@Controller("account")
@UseFilters(AccountExceptionFilter)
export class AccountAuthController {
  constructor(
    @Inject(AccountService) private readonly accounts: AccountService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  @Post("register")
  async register(
    @Req() request: AccountRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertAccountOrigin(request, this.config.get<string>("WEB_ORIGIN"));
    const input = parse(accountRegisterSchema, body);
    await this.accounts.throttle(`ip:${request.socket.remoteAddress ?? "unknown"}`);
    await this.accounts.throttle(`email:${input.email}`);
    const result = await this.accounts.register(input);
    cookie(response, result.token, this.config.get("NODE_ENV") === "production");
    return accountSessionSchema.parse(
      await this.accounts.snapshot({ session: result.session, role: "OWNER" }),
    );
  }
  @Post("login")
  async login(
    @Req() request: AccountRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertAccountOrigin(request, this.config.get<string>("WEB_ORIGIN"));
    const input = parse(accountLoginSchema, body);
    await this.accounts.throttle(`ip:${request.socket.remoteAddress ?? "unknown"}`);
    await this.accounts.throttle(`email:${input.email}`);
    const result = await this.accounts.login(input);
    cookie(response, result.token, this.config.get("NODE_ENV") === "production");
    return accountSessionSchema.parse(
      await this.accounts.snapshot(await this.accounts.authenticate(result.token)),
    );
  }
}
@Controller("account")
@UseGuards(AccountGuard)
@UseFilters(AccountExceptionFilter)
export class AccountController {
  constructor(@Inject(AccountService) private readonly accounts: AccountService) {}
  @Get("session")
  async session(@Req() request: AccountRequest, @Res({ passthrough: true }) response: Response) {
    privateResponse(response);
    return accountSessionSchema.parse(await this.accounts.snapshot(principal(request)));
  }
  @Get("overview")
  async overview(@Req() request: AccountRequest, @Res({ passthrough: true }) response: Response) {
    privateResponse(response);
    return accountOverviewSchema.parse(await this.accounts.overview(principal(request)));
  }
  @Put("profile")
  async profile(@Req() request: AccountRequest, @Body() body: unknown) {
    await this.accounts.profile(principal(request), parse(accountProfileUpdateSchema, body));
    return { saved: true };
  }
  @Put("organization")
  async organization(@Req() request: AccountRequest, @Body() body: unknown) {
    await this.accounts.organization(
      principal(request),
      parse(accountOrganizationUpdateSchema, body),
    );
    return { saved: true };
  }
  @Put("session/organization")
  async switchOrganization(@Req() request: AccountRequest, @Body() body: unknown) {
    await this.accounts.switchOrganization(
      principal(request),
      parse(accountSwitchSchema, body).organizationId,
    );
    return { saved: true };
  }
  @Post("invitations")
  async invite(
    @Req() request: AccountRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    privateResponse(response);
    return accountInviteResultSchema.parse(
      await this.accounts.invite(principal(request), parse(accountInviteSchema, body)),
    );
  }
  @Delete("invitations/:id")
  async revokeInvite(@Req() request: AccountRequest, @Param("id", ParseUUIDPipe) id: string) {
    await this.accounts.revokeInvitation(principal(request), id);
    return { saved: true };
  }
  @Post("invitations/accept")
  async acceptInvite(@Req() request: AccountRequest, @Body() body: unknown) {
    await this.accounts.acceptInvitation(
      principal(request),
      parse(accountAcceptInviteSchema, body).token,
    );
    return { saved: true };
  }
  @Patch("members/:id")
  async member(
    @Req() request: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    await this.accounts.member(principal(request), id, parse(accountMemberUpdateSchema, body));
    return { saved: true };
  }
  @Get("sessions")
  async sessions(@Req() request: AccountRequest, @Res({ passthrough: true }) response: Response) {
    privateResponse(response);
    return accountSessionsSchema.parse(await this.accounts.sessions(principal(request)));
  }
  @Delete("sessions/:id")
  async revokeSession(@Req() request: AccountRequest, @Param("id", ParseUUIDPipe) id: string) {
    await this.accounts.revokeSession(principal(request), id);
    return { saved: true };
  }
  @Put("password")
  async password(@Req() request: AccountRequest, @Body() body: unknown) {
    const input = parse(accountPasswordUpdateSchema, body);
    await this.accounts.throttle(`password:${principal(request).session.userId}`);
    await this.accounts.password(
      principal(request),
      input.currentPassword,
      input.newPassword,
      input,
    );
    return { saved: true };
  }
  @Post("logout")
  async logout(@Req() request: AccountRequest, @Res({ passthrough: true }) response: Response) {
    await this.accounts.revokeSession(principal(request), principal(request).session.id);
    cookie(response, "", false);
    return { saved: true };
  }
}
