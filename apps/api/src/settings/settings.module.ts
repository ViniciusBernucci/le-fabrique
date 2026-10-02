import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import {
  GithubOnboardingAdminController,
  GithubOnboardingWorkerController,
} from "./github-onboarding.controller";
import {
  GITHUB_ONBOARDING_QUEUE,
  GithubOnboardingDispatcher,
} from "./github-onboarding.dispatcher";
import { GithubOnboardingService } from "./github-onboarding.service";
import {
  GithubPullRequestAdminController,
  GithubPullRequestWorkerController,
} from "./github-pull-request.controller";
import {
  GITHUB_PULL_REQUEST_QUEUE,
  GithubPullRequestDispatcher,
} from "./github-pull-request.dispatcher";
import { GithubPullRequestService } from "./github-pull-request.service";
import {
  GithubRepositoryVerificationAdminController,
  GithubRepositoryVerificationWorkerController,
} from "./github-repository-verification.controller";
import {
  GITHUB_REPOSITORY_VERIFICATION_QUEUE,
  GithubRepositoryVerificationDispatcher,
} from "./github-repository-verification.dispatcher";
import { GithubRepositoryVerificationService } from "./github-repository-verification.service";
import {
  GithubVerificationAdminController,
  GithubVerificationWorkerController,
} from "./github-verification.controller";
import {
  GITHUB_VERIFICATION_QUEUE,
  GithubVerificationDispatcher,
} from "./github-verification.dispatcher";
import { GithubVerificationService } from "./github-verification.service";
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
import { WorkerSettingsController } from "./worker-settings.controller";

@Module({
  controllers: [
    SettingsController,
    WorkerSettingsController,
    ProviderVerificationAdminController,
    ProviderVerificationWorkerController,
    ProviderOnboardingAdminController,
    ProviderOnboardingWorkerController,
    GithubVerificationAdminController,
    GithubVerificationWorkerController,
    GithubOnboardingAdminController,
    GithubOnboardingWorkerController,
    GithubRepositoryVerificationAdminController,
    GithubRepositoryVerificationWorkerController,
    GithubPullRequestAdminController,
    GithubPullRequestWorkerController,
  ],
  providers: [
    AdminAuthGuard,
    WorkerAuthGuard,
    SettingsService,
    ProviderVerificationService,
    ProviderVerificationDispatcher,
    ProviderOnboardingService,
    ProviderOnboardingDispatcher,
    GithubVerificationService,
    GithubVerificationDispatcher,
    GithubOnboardingService,
    GithubOnboardingDispatcher,
    GithubRepositoryVerificationService,
    GithubRepositoryVerificationDispatcher,
    GithubPullRequestService,
    GithubPullRequestDispatcher,
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
    {
      provide: GITHUB_VERIFICATION_QUEUE,
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
        return new Queue("le-fabrique.github-verification", {
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
      provide: GITHUB_ONBOARDING_QUEUE,
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
        return new Queue("le-fabrique.github-onboarding", {
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
      provide: GITHUB_REPOSITORY_VERIFICATION_QUEUE,
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
        return new Queue("le-fabrique.github-repository-verification", {
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
      provide: GITHUB_PULL_REQUEST_QUEUE,
      useFactory: () => {
        const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
        return new Queue("le-fabrique.github-pull-request", {
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
