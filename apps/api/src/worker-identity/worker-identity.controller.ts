import {
  workerHeartbeatSchema,
  workerListSchema,
  workerRegistrationSchema,
  workerSchema,
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
import { WorkerAuthGuard } from "./worker-auth.guard";
import { WorkerIdentityService } from "./worker-identity.service";

@Controller("internal/workers")
export class WorkerIdentityController {
  constructor(@Inject(WorkerIdentityService) private readonly workers: WorkerIdentityService) {}

  @Post("register")
  @UseGuards(WorkerAuthGuard)
  async register(@Body() body: unknown) {
    const input = workerRegistrationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid worker registration");
    return workerSchema.parse(await this.workers.register(input.data));
  }

  @Post(":workerId/heartbeat")
  @UseGuards(WorkerAuthGuard)
  async heartbeat(@Param("workerId", ParseUUIDPipe) workerId: string) {
    return workerHeartbeatSchema.parse(await this.workers.heartbeat(workerId));
  }
}

@Controller("workers")
@UseGuards(AdminAuthGuard)
export class WorkerAdminController {
  constructor(@Inject(WorkerIdentityService) private readonly workers: WorkerIdentityService) {}

  @Get()
  async list() {
    return workerListSchema.parse(await this.workers.list());
  }
}
