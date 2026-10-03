import { approveRunDeliverySchema } from "@le-fabrique/contracts";
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
import { RunDeliveryService } from "./run-delivery.service";

@Controller("runs")
@UseGuards(AdminAuthGuard)
export class RunDeliveryController {
  constructor(@Inject(RunDeliveryService) private readonly delivery: RunDeliveryService) {}
  @Get(":runId/delivery")
  get(@Param("runId", ParseUUIDPipe) runId: string) {
    return this.delivery.get(runId);
  }
  @Post(":runId/approve-delivery")
  approve(@Param("runId", ParseUUIDPipe) runId: string, @Body() body: unknown) {
    const input = approveRunDeliverySchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid delivery approval payload");
    return this.delivery.approve(runId, input.data);
  }
}
