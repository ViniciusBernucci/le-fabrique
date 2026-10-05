import { Module } from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { ControlController } from "./control.controller";
import { ControlService } from "./control.service";

@Module({ controllers: [ControlController], providers: [AdminAuthGuard, ControlService] })
export class ControlModule {}
