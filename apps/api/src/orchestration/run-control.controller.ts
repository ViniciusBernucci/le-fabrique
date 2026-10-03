import { requestRunControlSchema, requestRunResumeSchema } from "@le-fabrique/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { RunControlService } from "./run-control.service";
import { RunResumeService } from "./run-resume.service";

@Controller("runs")
@UseGuards(AdminAuthGuard)
export class RunControlController {
  constructor(
    @Inject(RunControlService) private readonly control: RunControlService,
    @Inject(RunResumeService) private readonly resume: RunResumeService,
  ) {}
  @Post(":runId/resume")
  requestResume(@Param("runId", ParseUUIDPipe) runId: string, @Body() body: unknown) {
    const input = requestRunResumeSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid resume payload");
    return this.resume.request(runId, input.data);
  }
  @Post(":runId/control")
  request(@Param("runId", ParseUUIDPipe) runId: string, @Body() body: unknown) {
    const input = requestRunControlSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid run control payload");
    return this.control.request(runId, input.data);
  }
}
