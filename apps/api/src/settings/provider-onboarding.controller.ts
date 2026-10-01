import {
  completeProviderOnboardingSchema,
  providerOnboardingChallengeSchema,
  providerOnboardingSessionListSchema,
  providerOnboardingSessionSchema,
  publishProviderOnboardingChallengeSchema,
  startProviderOnboardingSchema,
} from "@le-fabrique/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { ProviderOnboardingService } from "./provider-onboarding.service";

@Controller("settings")
@UseGuards(AdminAuthGuard)
export class ProviderOnboardingAdminController {
  constructor(
    @Inject(ProviderOnboardingService) private readonly onboarding: ProviderOnboardingService,
  ) {}

  @Post("installations/:installationId/onboarding")
  async request(@Param("installationId") installationId: string) {
    return providerOnboardingSessionSchema.parse(await this.onboarding.request(installationId));
  }

  @Get("onboarding")
  async list() {
    return providerOnboardingSessionListSchema.parse(await this.onboarding.list());
  }

  @Get("onboarding/:id/challenge")
  async challenge(@Param("id", ParseUUIDPipe) id: string) {
    return providerOnboardingChallengeSchema.parse(await this.onboarding.getChallenge(id));
  }
}

@Controller("internal/provider-onboarding")
@UseGuards(WorkerAuthGuard)
export class ProviderOnboardingWorkerController {
  constructor(
    @Inject(ProviderOnboardingService) private readonly onboarding: ProviderOnboardingService,
  ) {}

  @Post(":id/start")
  async start(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = startProviderOnboardingSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid onboarding start payload");
    return providerOnboardingSessionSchema.parse(
      await this.onboarding.start(id, input.data.workerId),
    );
  }

  @Post(":id/challenge")
  async publishChallenge(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = publishProviderOnboardingChallengeSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid onboarding challenge payload");
    return providerOnboardingSessionSchema.parse(
      await this.onboarding.publishChallenge(id, input.data.workerId, input.data.challenge),
    );
  }

  @Post(":id/complete")
  async complete(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = completeProviderOnboardingSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid onboarding result payload");
    return providerOnboardingSessionSchema.parse(await this.onboarding.complete(id, input.data));
  }
}
