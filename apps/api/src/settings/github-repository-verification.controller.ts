import {
  completeGithubRepositoryVerificationSchema,
  githubRepositoryVerificationListSchema,
  githubRepositoryVerificationSchema,
  startGithubRepositoryVerificationSchema,
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
import { GithubRepositoryVerificationService } from "./github-repository-verification.service";

@Controller("settings/github/repository-verifications")
@UseGuards(AdminAuthGuard)
export class GithubRepositoryVerificationAdminController {
  constructor(
    @Inject(GithubRepositoryVerificationService)
    private readonly verifications: GithubRepositoryVerificationService,
  ) {}

  @Post()
  async request() {
    return githubRepositoryVerificationSchema.parse(await this.verifications.request());
  }

  @Get()
  async list() {
    return githubRepositoryVerificationListSchema.parse(await this.verifications.list());
  }
}

@Controller("internal/github-repository-verifications")
@UseGuards(WorkerAuthGuard)
export class GithubRepositoryVerificationWorkerController {
  constructor(
    @Inject(GithubRepositoryVerificationService)
    private readonly verifications: GithubRepositoryVerificationService,
  ) {}

  @Post(":id/start")
  async start(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = startGithubRepositoryVerificationSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid GitHub repository verification start payload");
    }
    return githubRepositoryVerificationSchema.parse(
      await this.verifications.start(id, input.data.workerId),
    );
  }

  @Post(":id/complete")
  async complete(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = completeGithubRepositoryVerificationSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid GitHub repository verification result payload");
    }
    return githubRepositoryVerificationSchema.parse(
      await this.verifications.complete(id, input.data),
    );
  }
}
