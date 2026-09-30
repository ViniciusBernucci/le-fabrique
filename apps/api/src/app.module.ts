import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { z } from "zod";
import { ControlModule } from "./control/control.module";
import { HealthModule } from "./health/health.module";
import { InfrastructureModule } from "./infrastructure.module";
import { OrchestrationModule } from "./orchestration/orchestration.module";
import { WorkerIdentityModule } from "./worker-identity/worker-identity.module";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url().startsWith("postgresql://"),
  REDIS_URL: z.url().startsWith("redis://"),
  ADMIN_API_TOKEN: z.string().min(32),
  WORKER_API_TOKEN: z.string().min(32),
  WEB_ORIGIN: z.url().optional(),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (environment) => environmentSchema.parse(environment),
    }),
    InfrastructureModule,
    ControlModule,
    WorkerIdentityModule,
    OrchestrationModule,
    HealthModule,
  ],
})
export class AppModule {}
