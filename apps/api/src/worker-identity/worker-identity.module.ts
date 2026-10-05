import { Module } from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "./worker-auth.guard";
import { WorkerAdminController, WorkerIdentityController } from "./worker-identity.controller";
import { WorkerIdentityService } from "./worker-identity.service";

@Module({
  controllers: [WorkerIdentityController, WorkerAdminController],
  providers: [AdminAuthGuard, WorkerAuthGuard, WorkerIdentityService],
})
export class WorkerIdentityModule {}
