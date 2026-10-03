import { requestRunControlSchema } from "@le-fabrique/contracts";
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

@Controller("runs")
@UseGuards(AdminAuthGuard)
export class RunControlController {
  constructor(@Inject(RunControlService) private readonly control: RunControlService) {}
  @Post(":runId/control")
  request(@Param("runId", ParseUUIDPipe) runId: string, @Body() body: unknown) {
    const input = requestRunControlSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid run control payload");
    return this.control.request(runId, input.data);
  }
}
