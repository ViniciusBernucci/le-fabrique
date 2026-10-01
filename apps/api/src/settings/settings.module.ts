import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import {
  ProviderOnboardingAdminController,
  ProviderOnboardingWorkerController,
} from "./provider-onboarding.controller";
import {
  PROVIDER_ONBOARDING_QUEUE,
  ProviderOnboardingDispatcher,
} from "./provider-onboarding.dispatcher";
import { ProviderOnboardingService } from "./provider-onboarding.service";
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
    ProviderOnboardingAdminController,
    ProviderOnboardingWorkerController,
  ],
  providers: [
    AdminAuthGuard,
    WorkerAuthGuard,
    SettingsService,
    ProviderVerificationService,
    ProviderVerificationDispatcher,
    ProviderOnboardingService,
    ProviderOnboardingDispatcher,
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
    {
      provide: PROVIDER_ONBOARDING_QUEUE,
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
        return new Queue("le-fabrique.provider-onboarding", {
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
