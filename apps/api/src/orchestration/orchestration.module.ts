import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { ExecutionArtifactsService } from "./execution-artifacts.service";
import {
  RunResultsController,
  WorkerExecutionResultsController,
} from "./execution-results.controller";
import { ExecutionResultsService } from "./execution-results.service";
import { OperationStatusController } from "./operation-status.controller";
import { OperationStatusService } from "./operation-status.service";
import { OrchestrationController } from "./orchestration.controller";
import { OrchestrationService } from "./orchestration.service";
import { ORCHESTRATION_QUEUE, OutboxDispatcher } from "./outbox-dispatcher";
import { ProjectEventsController } from "./project-events.controller";
import { ProjectEventsService } from "./project-events.service";
import { RunControlController } from "./run-control.controller";
import { RunControlService } from "./run-control.service";
import { RunDeliveryController } from "./run-delivery.controller";
import { RunDeliveryService } from "./run-delivery.service";
import { RunRecoveryController } from "./run-recovery.controller";
import { RunRecoveryService } from "./run-recovery.service";
import { RunResumeService } from "./run-resume.service";

@Module({
  controllers: [
    ProjectEventsController,
    OperationStatusController,
    OrchestrationController,
    RunResultsController,
    WorkerExecutionResultsController,
    RunDeliveryController,
    RunControlController,
    RunRecoveryController,
  ],
  providers: [
    ProjectEventsService,
    OperationStatusService,
    WorkerAuthGuard,
    AdminAuthGuard,
    ExecutionResultsService,
    ExecutionArtifactsService,
    RunDeliveryService,
    RunControlService,
    RunResumeService,
    RunRecoveryService,
    OrchestrationService,
    OutboxDispatcher,
    {
      provide: ORCHESTRATION_QUEUE,
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
        return new Queue("le-fabrique.execution", {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
            db: Number(redisUrl.pathname.slice(1) || 0),
          },
        });
      },
    },
  ],
})
export class OrchestrationModule {}
