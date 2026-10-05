import { requestRunRecoverySchema } from "@le-fabrique/contracts";
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
import { RunRecoveryService } from "./run-recovery.service";
@Controller("runs")
@UseGuards(AdminAuthGuard)
export class RunRecoveryController {
  constructor(@Inject(RunRecoveryService) private readonly recovery: RunRecoveryService) {}
  @Post(":runId/recover-finalization")
  request(@Param("runId", ParseUUIDPipe) runId: string, @Body() body: unknown) {
    const input = requestRunRecoverySchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid recovery payload");
    return this.recovery.request(runId, input.data);
  }
}
