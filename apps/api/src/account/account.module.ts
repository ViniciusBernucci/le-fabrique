import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { AccountAuthController, AccountController } from "./account.controller";
import { AccountGuard } from "./account.guard";
import { AccountService } from "./account.service";
import { AccountBillingService } from "./account-billing.service";
import { AccountDataService } from "./account-data.service";
import { AccountEmailService } from "./account-email.service";
import {
  AccountBillingWebhookController,
  AccountFeaturesController,
  AccountRecoveryController,
} from "./account-features.controller";
import { AccountIdentityService } from "./account-identity.service";
import { AccountWorkController } from "./account-work.controller";
import { AccountWorkService } from "./account-work.service";
import { AccountWorkerController } from "./account-worker.controller";
@Module({
  imports: [SettingsModule],
  controllers: [
    AccountAuthController,
    AccountController,
    AccountWorkController,
    AccountRecoveryController,
    AccountFeaturesController,
    AccountBillingWebhookController,
    AccountWorkerController,
  ],
  providers: [
    AccountService,
    AccountGuard,
    WorkerAuthGuard,
    AccountWorkService,
    AccountDataService,
    AccountIdentityService,
    AccountEmailService,
    AccountBillingService,
  ],
})
export class AccountModule {}
