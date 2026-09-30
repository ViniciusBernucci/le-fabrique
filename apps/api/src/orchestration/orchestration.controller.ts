import {
  orchestrationCheckpointRequestSchema,
  orchestrationClaimRequestSchema,
  orchestrationClaimSchema,
  orchestrationCompleteRequestSchema,
  orchestrationLeaseRequestSchema,
  orchestrationStateSchema,
} from "@le-fabrique/contracts";
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
import type { z } from "zod";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { OrchestrationService } from "./orchestration.service";

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("Invalid orchestration payload");
  return result.data;
}

@Controller("internal/orchestration")
@UseGuards(WorkerAuthGuard)
export class OrchestrationController {
  constructor(@Inject(OrchestrationService) private readonly orchestration: OrchestrationService) {}

  @Post("claims")
  async claim(@Body() body: unknown) {
    return orchestrationClaimSchema.parse(
      await this.orchestration.claim(parse(orchestrationClaimRequestSchema, body)),
    );
  }

  @Post("attempts/:attemptId/lease")
  async renew(@Param("attemptId", ParseUUIDPipe) attemptId: string, @Body() body: unknown) {
    return orchestrationClaimSchema.parse(
      await this.orchestration.renew(attemptId, parse(orchestrationLeaseRequestSchema, body)),
    );
  }

  @Post("attempts/:attemptId/checkpoint")
  async checkpoint(@Param("attemptId", ParseUUIDPipe) attemptId: string, @Body() body: unknown) {
    return orchestrationStateSchema.parse(
      await this.orchestration.checkpoint(
        attemptId,
        parse(orchestrationCheckpointRequestSchema, body),
      ),
    );
  }

  @Post("attempts/:attemptId/complete")
  async complete(@Param("attemptId", ParseUUIDPipe) attemptId: string, @Body() body: unknown) {
    return orchestrationStateSchema.parse(
      await this.orchestration.complete(attemptId, parse(orchestrationCompleteRequestSchema, body)),
    );
  }
}
