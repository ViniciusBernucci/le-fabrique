import { reportExecutionResultSchema } from "@le-fabrique/contracts";
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
import { ExecutionResultsService } from "./execution-results.service";

@Controller("runs")
@UseGuards(AdminAuthGuard)
export class RunResultsController {
  constructor(@Inject(ExecutionResultsService) private readonly results: ExecutionResultsService) {}

  @Get()
  list(@Query("projectId", ParseUUIDPipe) projectId: string) {
    return this.results.list(projectId);
  }

  @Get(":runId")
  detail(@Param("runId", ParseUUIDPipe) runId: string) {
    return this.results.detail(runId);
  }
}

@Controller("internal/orchestration/attempts")
@UseGuards(WorkerAuthGuard)
export class WorkerExecutionResultsController {
  constructor(@Inject(ExecutionResultsService) private readonly results: ExecutionResultsService) {}

  @Post(":attemptId/result")
  report(@Param("attemptId", ParseUUIDPipe) attemptId: string, @Body() body: unknown) {
    const input = reportExecutionResultSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid execution result payload");
    return this.results.report(attemptId, input.data);
  }
}
