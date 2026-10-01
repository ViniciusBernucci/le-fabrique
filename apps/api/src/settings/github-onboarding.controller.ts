import {
  completeGithubOnboardingSchema,
  githubOnboardingChallengeSchema,
  githubOnboardingSessionListSchema,
  githubOnboardingSessionSchema,
  publishGithubOnboardingChallengeSchema,
  startGithubOnboardingSchema,
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
import { GithubOnboardingService } from "./github-onboarding.service";

@Controller("settings/github/onboarding")
@UseGuards(AdminAuthGuard)
export class GithubOnboardingAdminController {
  constructor(
    @Inject(GithubOnboardingService) private readonly onboarding: GithubOnboardingService,
  ) {}

  @Post()
  async request() {
    return githubOnboardingSessionSchema.parse(await this.onboarding.request());
  }

  @Get()
  async list() {
    return githubOnboardingSessionListSchema.parse(await this.onboarding.list());
  }

  @Get(":id/challenge")
  async challenge(@Param("id", ParseUUIDPipe) id: string) {
    return githubOnboardingChallengeSchema.parse(await this.onboarding.getChallenge(id));
  }
}

@Controller("internal/github-onboarding")
@UseGuards(WorkerAuthGuard)
export class GithubOnboardingWorkerController {
  constructor(
    @Inject(GithubOnboardingService) private readonly onboarding: GithubOnboardingService,
  ) {}

  @Post(":id/start")
  async start(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = startGithubOnboardingSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid GitHub onboarding start payload");
    return githubOnboardingSessionSchema.parse(
      await this.onboarding.start(id, input.data.workerId),
    );
  }

  @Post(":id/challenge")
  async publishChallenge(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = publishGithubOnboardingChallengeSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException("Invalid GitHub onboarding challenge payload");
    return githubOnboardingSessionSchema.parse(
      await this.onboarding.publishChallenge(id, input.data.workerId, input.data.challenge),
    );
  }

  @Post(":id/complete")
  async complete(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = completeGithubOnboardingSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid GitHub onboarding result payload");
    return githubOnboardingSessionSchema.parse(await this.onboarding.complete(id, input.data));
  }
}
