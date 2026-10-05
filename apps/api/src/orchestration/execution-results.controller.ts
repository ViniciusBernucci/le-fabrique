import { reportExecutionArtifactSchema, reportExecutionResultSchema } from "@le-fabrique/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { ExecutionArtifactsService } from "./execution-artifacts.service";
import { ExecutionResultsService } from "./execution-results.service";

@Controller("runs")
@UseGuards(AdminAuthGuard)
export class RunResultsController {
  constructor(
    @Inject(ExecutionResultsService) private readonly results: ExecutionResultsService,
    @Inject(ExecutionArtifactsService) private readonly artifacts: ExecutionArtifactsService,
  ) {}

  @Get()
  list(@Query("projectId", ParseUUIDPipe) projectId: string) {
    return this.results.list(projectId);
  }

  @Get(":runId")
  detail(@Param("runId", ParseUUIDPipe) runId: string) {
    return this.results.detail(runId);
  }

  @Get(":runId/attempts/:attemptId/artifact")
  artifact(
    @Param("runId", ParseUUIDPipe) runId: string,
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
  ) {
    return this.artifacts.get(runId, attemptId);
  }
}

@Controller("internal/orchestration/attempts")
@UseGuards(WorkerAuthGuard)
export class WorkerExecutionResultsController {
  constructor(
    @Inject(ExecutionResultsService) private readonly results: ExecutionResultsService,
    @Inject(ExecutionArtifactsService) private readonly artifacts: ExecutionArtifactsService,
  ) {}

  @Post(":attemptId/result")
  report(@Param("attemptId", ParseUUIDPipe) attemptId: string, @Body() body: unknown) {
    const input = reportExecutionResultSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid execution result payload");
    return this.results.report(attemptId, input.data);
  }

  @Post(":attemptId/artifact")
  reportArtifact(@Param("attemptId", ParseUUIDPipe) attemptId: string, @Body() body: unknown) {
    const input = reportExecutionArtifactSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid execution artifact payload");
    return this.artifacts.report(attemptId, input.data);
  }
}
