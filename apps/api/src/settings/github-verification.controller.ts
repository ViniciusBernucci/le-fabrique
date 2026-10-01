import {
  completeGithubVerificationSchema,
  githubVerificationListSchema,
  githubVerificationSchema,
  startGithubVerificationSchema,
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
import { GithubVerificationService } from "./github-verification.service";

@Controller("settings/github/verifications")
@UseGuards(AdminAuthGuard)
export class GithubVerificationAdminController {
  constructor(
    @Inject(GithubVerificationService)
    private readonly verifications: GithubVerificationService,
  ) {}

  @Post()
  async request() {
    return githubVerificationSchema.parse(await this.verifications.request());
  }

  @Get()
  async list() {
    return githubVerificationListSchema.parse(await this.verifications.list());
  }
}

@Controller("internal/github-verifications")
@UseGuards(WorkerAuthGuard)
export class GithubVerificationWorkerController {
  constructor(
    @Inject(GithubVerificationService)
    private readonly verifications: GithubVerificationService,
  ) {}

  @Post(":id/start")
  async start(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = startGithubVerificationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid GitHub verification start payload");
    return githubVerificationSchema.parse(await this.verifications.start(id, input.data.workerId));
  }

  @Post(":id/complete")
  async complete(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = completeGithubVerificationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid GitHub verification result payload");
    return githubVerificationSchema.parse(await this.verifications.complete(id, input.data));
  }
}
