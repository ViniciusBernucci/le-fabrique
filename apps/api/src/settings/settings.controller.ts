import { factorySettingsSchema, updateFactorySettingsSchema } from "@le-fabrique/contracts";
import { BadRequestException, Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(AdminAuthGuard)
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  async get() {
    return factorySettingsSchema.parse(await this.settings.get());
  }

  @Put()
  async update(@Body() body: unknown) {
    const input = updateFactorySettingsSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid settings payload");
    return factorySettingsSchema.parse(
      await this.settings.update(
        input.data.expectedVersion,
        input.data.configuration,
        input.data.apiKeys,
      ),
    );
  }
}
