import { workerConfigurationSnapshotSchema } from "@le-fabrique/contracts";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { SettingsService } from "./settings.service";

@Controller("internal/worker-settings")
@UseGuards(WorkerAuthGuard)
export class WorkerSettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  async getConfiguration() {
    return workerConfigurationSnapshotSchema.parse(
      await this.settings.getWorkerConfigurationSnapshot(),
    );
  }
}
