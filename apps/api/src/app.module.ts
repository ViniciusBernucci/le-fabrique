import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { z } from "zod";
import { HealthModule } from "./health/health.module";
import { InfrastructureModule } from "./infrastructure.module";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url().startsWith("postgresql://"),
  REDIS_URL: z.url().startsWith("redis://"),
  WEB_ORIGIN: z.url().optional(),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (environment) => environmentSchema.parse(environment),
    }),
    InfrastructureModule,
    HealthModule,
  ],
})
export class AppModule {}
