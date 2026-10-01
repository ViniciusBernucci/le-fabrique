import {
  completeProviderVerificationSchema,
  providerVerificationListSchema,
  providerVerificationSchema,
  startProviderVerificationSchema,
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
import { ProviderVerificationService } from "./provider-verification.service";

@Controller("settings")
@UseGuards(AdminAuthGuard)
export class ProviderVerificationAdminController {
  constructor(
    @Inject(ProviderVerificationService)
    private readonly verifications: ProviderVerificationService,
  ) {}

  @Post("installations/:installationId/verifications")
  async request(@Param("installationId") installationId: string) {
    return providerVerificationSchema.parse(await this.verifications.request(installationId));
  }

  @Get("verifications")
  async list() {
    return providerVerificationListSchema.parse(await this.verifications.list());
  }
}

@Controller("internal/provider-verifications")
@UseGuards(WorkerAuthGuard)
export class ProviderVerificationWorkerController {
  constructor(
    @Inject(ProviderVerificationService)
    private readonly verifications: ProviderVerificationService,
  ) {}

  @Post(":id/start")
  async start(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = startProviderVerificationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid verification start payload");
    return providerVerificationSchema.parse(
      await this.verifications.start(id, input.data.workerId),
    );
  }

  @Post(":id/complete")
  async complete(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = completeProviderVerificationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid verification result payload");
    return providerVerificationSchema.parse(await this.verifications.complete(id, input.data));
  }
}
