import { Module } from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({ controllers: [SettingsController], providers: [AdminAuthGuard, SettingsService] })
export class SettingsModule {}
