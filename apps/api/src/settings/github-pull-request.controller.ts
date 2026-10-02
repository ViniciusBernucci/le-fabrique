import {
  approveGithubPullRequestSchema,
  cancelGithubPullRequestSchema,
  completeGithubPullRequestSchema,
  githubPullRequestListSchema,
  githubPullRequestSchema,
  prepareGithubPullRequestSchema,
  startGithubPullRequestSchema,
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
import { GithubPullRequestService } from "./github-pull-request.service";

@Controller("settings/github/pull-requests")
@UseGuards(AdminAuthGuard)
export class GithubPullRequestAdminController {
  constructor(
    @Inject(GithubPullRequestService) private readonly requests: GithubPullRequestService,
  ) {}

  @Post()
  async prepare(@Body() body: unknown) {
    const input = prepareGithubPullRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid pull request preparation payload");
    return githubPullRequestSchema.parse(await this.requests.prepare(input.data));
  }

  @Get()
  async list() {
    return githubPullRequestListSchema.parse(await this.requests.list());
  }

  @Post(":id/approve")
  async approve(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = approveGithubPullRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid pull request approval payload");
    return githubPullRequestSchema.parse(await this.requests.approve(id, input.data));
  }

  @Post(":id/cancel")
  async cancel(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = cancelGithubPullRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid pull request cancellation payload");
    return githubPullRequestSchema.parse(
      await this.requests.cancel(id, input.data.expectedVersion),
    );
  }
}

@Controller("internal/github-pull-requests")
@UseGuards(WorkerAuthGuard)
export class GithubPullRequestWorkerController {
  constructor(
    @Inject(GithubPullRequestService) private readonly requests: GithubPullRequestService,
  ) {}

  @Post(":id/start")
  async start(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = startGithubPullRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid pull request start payload");
    return githubPullRequestSchema.parse(await this.requests.start(id, input.data.workerId));
  }

  @Post(":id/complete")
  async complete(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = completeGithubPullRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid pull request result payload");
    return githubPullRequestSchema.parse(await this.requests.complete(id, input.data));
  }
}
