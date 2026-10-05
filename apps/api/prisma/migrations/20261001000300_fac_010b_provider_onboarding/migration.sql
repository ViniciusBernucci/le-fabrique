CREATE TYPE "ProviderOnboardingStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'AWAITING_USER',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE "provider_onboarding_sessions" (
  "id" UUID NOT NULL,
  "installation_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "ProviderOnboardingStatus" NOT NULL DEFAULT 'PENDING',
  "worker_id" UUID,
  "provider_state" TEXT,
  "message" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "provider_onboarding_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_onboarding_sessions_installation_id_created_at_idx"
  ON "provider_onboarding_sessions"("installation_id", "created_at");
CREATE INDEX "provider_onboarding_sessions_status_created_at_idx"
  ON "provider_onboarding_sessions"("status", "created_at");
CREATE UNIQUE INDEX "provider_onboarding_sessions_one_active_per_installation"
  ON "provider_onboarding_sessions"("installation_id")
  WHERE "status" IN ('PENDING', 'RUNNING', 'AWAITING_USER');
