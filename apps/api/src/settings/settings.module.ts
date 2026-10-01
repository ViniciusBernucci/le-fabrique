import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import {
  ProviderVerificationAdminController,
  ProviderVerificationWorkerController,
} from "./provider-verification.controller";
import {
  PROVIDER_VERIFICATION_QUEUE,
  ProviderVerificationDispatcher,
} from "./provider-verification.dispatcher";
import { ProviderVerificationService } from "./provider-verification.service";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [
    SettingsController,
    ProviderVerificationAdminController,
    ProviderVerificationWorkerController,
  ],
  providers: [
    AdminAuthGuard,
    WorkerAuthGuard,
    SettingsService,
    ProviderVerificationService,
    ProviderVerificationDispatcher,
    {
      provide: PROVIDER_VERIFICATION_QUEUE,
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
        return new Queue("le-fabrique.provider-verification", {
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
export class SettingsModule {}
