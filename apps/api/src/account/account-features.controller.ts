import {
  accountChangeEmailSchema,
  accountDataSettingsSchema,
  accountIntegrationInputSchema,
  accountMfaConfirmSchema,
  accountPlanSelectionSchema,
  accountRecoverSchema,
  accountResetSchema,
  accountSensitiveSchema,
  accountTokenInputSchema,
  accountTransferSchema,
  providerAuthorizationCodeSchema,
} from "@le-fabrique/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { AccountGuard, type AccountRequest, assertAccountOrigin } from "./account.guard";
import { AccountService } from "./account.service";
import { AccountBillingService } from "./account-billing.service";
import { AccountDataService } from "./account-data.service";
import { AccountExceptionFilter } from "./account-exception.filter";
import { AccountIdentityService } from "./account-identity.service";

const parse = <T extends z.ZodType>(s: T, b: unknown): z.infer<T> => {
  const v = s.safeParse(b);
  if (!v.success) throw new BadRequestException("Revise os campos informados.");
  return v.data;
};
const p = (r: AccountRequest) => {
  if (!r.principal) throw new Error("AccountGuard required");
  return r.principal;
};
@Controller("account")
@UseFilters(AccountExceptionFilter)
export class AccountRecoveryController {
  constructor(
    @Inject(AccountIdentityService) private readonly identity: AccountIdentityService,
    @Inject(AccountService) private readonly accounts: AccountService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  private async limit(r: AccountRequest) {
    assertAccountOrigin(r, this.config.get<string>("WEB_ORIGIN"));
    await this.accounts.throttle(`recovery-ip:${r.socket.remoteAddress ?? "unknown"}`);
  }
  @Post("recover") async recover(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    const v = parse(accountRecoverSchema, b);
    await this.accounts.throttle(`recovery-email:${v.email}`);
    await this.identity.recover(v.email);
    return { queued: true };
  }
  @Post("reset") async reset(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    const v = parse(accountResetSchema, b);
    await this.identity.consume(v.token, v.password, v);
    return { saved: true };
  }
  @Post("verify") async verify(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    await this.identity.consume(parse(accountTokenInputSchema, b).token);
    return { saved: true };
  }
}
@Controller("account")
@UseGuards(AccountGuard)
@UseFilters(AccountExceptionFilter)
export class AccountFeaturesController {
  constructor(
    @Inject(AccountIdentityService) private readonly identity: AccountIdentityService,
    @Inject(AccountBillingService) private readonly billing: AccountBillingService,
    @Inject(AccountDataService) private readonly data: AccountDataService,
    @Inject(AccountService) private readonly accounts: AccountService,
  ) {}
  private limit(r: AccountRequest) {
    return this.accounts.throttle(`sensitive:${p(r).session.userId}`);
  }
  @Post("email/verification") async verification(@Req() r: AccountRequest) {
    await this.limit(r);
    await this.identity.verification(p(r));
    return { queued: true };
  }
  @Post("email/change") async change(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    await this.identity.changeEmail(p(r), parse(accountChangeEmailSchema, b));
    return { queued: true };
  }
  @Post("mfa/prepare") async prepare(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    return this.identity.prepareMfa(p(r), parse(accountSensitiveSchema, b));
  }
  @Post("mfa/confirm") async confirm(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    return this.identity.confirmMfa(p(r), parse(accountMfaConfirmSchema, b).otp);
  }
  @Post("mfa/disable") async disable(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    await this.identity.disableMfa(p(r), parse(accountSensitiveSchema, b));
    return { saved: true };
  }
  @Get("billing") state(@Req() r: AccountRequest) {
    return this.billing.state(p(r));
  }
  @Post("billing/checkout") async checkout(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    const v = parse(accountPlanSelectionSchema, b);
    return this.billing.checkout(p(r), v.planId, v.requestId);
  }
  @Post("billing/portal") async portal(@Req() r: AccountRequest) {
    await this.limit(r);
    return this.billing.portal(p(r));
  }
  @Post("billing/reconcile") async reconcile(@Req() r: AccountRequest) {
    await this.limit(r);
    return this.billing.reconcile(p(r));
  }
  @Put("data/settings") settings(@Req() r: AccountRequest, @Body() b: unknown) {
    return this.data.settings(p(r), parse(accountDataSettingsSchema, b));
  }
  @Get("data/export") export(
    @Req() r: AccountRequest,
    @Query("section") section?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.data.export(
      p(r),
      parse(z.uuid().or(z.literal("")), cursor ?? ""),
      parse(
        z.enum([
          "profile",
          "projects",
          "tickets",
          "runs",
          "attempts",
          "members",
          "activity",
          "integrations",
        ]),
        section ?? "profile",
      ),
    );
  }
  @Get("notifications") notifications(@Req() r: AccountRequest) {
    return this.data.notifications(p(r));
  }
  @Patch("notifications/:id/read") read(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.data.readNotification(p(r), id);
  }
  @Get("integrations") integrations(@Req() r: AccountRequest) {
    return this.data.integrations(p(r));
  }
  @Post("integrations") integration(@Req() r: AccountRequest, @Body() b: unknown) {
    return this.data.integration(p(r), parse(accountIntegrationInputSchema, b));
  }
  @Patch("integrations/:id") enabled(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    const v = parse(
      z.object({ enabled: z.boolean(), expectedVersion: z.number().int().positive() }).strict(),
      b,
    );
    return this.data.integrationEnabled(p(r), id, v.enabled, v.expectedVersion);
  }
  @Put("integrations/:id/projects/:projectId") grant(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() b: unknown,
  ) {
    return this.data.integrationGrant(
      p(r),
      id,
      projectId,
      parse(z.object({ enabled: z.boolean() }).strict(), b).enabled,
    );
  }
  @Post("integrations/:id/login") login(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.data.onboardingRequest(p(r), id);
  }
  @Post("integrations/:id/verify") providerVerify(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.data.onboardingRequest(p(r), id, true);
  }
  @Get("integrations/:id/login/:loginId") loginState(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("loginId", ParseUUIDPipe) loginId: string,
  ) {
    return this.data.onboardingSession(p(r), id, loginId, "STATE");
  }
  @Get("integrations/:id/login/:loginId/challenge") challenge(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("loginId", ParseUUIDPipe) loginId: string,
  ) {
    return this.data.onboardingSession(p(r), id, loginId, "CHALLENGE");
  }
  @Post("integrations/:id/login/:loginId/code") code(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("loginId", ParseUUIDPipe) loginId: string,
    @Body() b: unknown,
  ) {
    return this.data.onboardingSession(
      p(r),
      id,
      loginId,
      "CODE",
      parse(providerAuthorizationCodeSchema, b).code,
    );
  }
  @Post("ownership/transfer") async transfer(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    return this.data.transfer(p(r), parse(accountTransferSchema, b));
  }
  @Post("ownership/accept") async accept(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    return this.data.acceptTransfer(
      p(r),
      parse(accountSensitiveSchema.extend({ token: accountTokenInputSchema.shape.token }), b),
    );
  }
  @Post("archive") async archive(@Req() r: AccountRequest, @Body() b: unknown) {
    await this.limit(r);
    return this.data.archive(p(r), parse(accountSensitiveSchema, b));
  }
}
@Controller("account/billing")
@UseFilters(AccountExceptionFilter)
export class AccountBillingWebhookController {
  constructor(@Inject(AccountBillingService) private readonly billing: AccountBillingService) {}
  @Post("webhook") webhook(
    @Req() r: { rawBody?: Buffer },
    @Headers("stripe-signature") signature?: string,
  ) {
    if (!r.rawBody) throw new BadRequestException("Raw body required");
    return this.billing.webhook(r.rawBody, signature ?? "");
  }
}
