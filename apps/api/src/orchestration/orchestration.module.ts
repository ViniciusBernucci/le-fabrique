import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import {
  RunResultsController,
  WorkerExecutionResultsController,
} from "./execution-results.controller";
import { ExecutionResultsService } from "./execution-results.service";
import { OrchestrationController } from "./orchestration.controller";
import { OrchestrationService } from "./orchestration.service";
import { ORCHESTRATION_QUEUE, OutboxDispatcher } from "./outbox-dispatcher";

@Module({
  controllers: [OrchestrationController, RunResultsController, WorkerExecutionResultsController],
  providers: [
    WorkerAuthGuard,
    AdminAuthGuard,
    ExecutionResultsService,
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
