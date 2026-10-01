CREATE TYPE "GithubOnboardingStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'AWAITING_USER',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE "github_onboarding_sessions" (
  "id" UUID NOT NULL,
  "host" TEXT NOT NULL,
  "status" "GithubOnboardingStatus" NOT NULL DEFAULT 'PENDING',
  "worker_id" UUID,
  "github_state" TEXT,
  "credential_storage" TEXT,
  "message" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "github_onboarding_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "github_onboarding_sessions_status_created_at_idx"
  ON "github_onboarding_sessions"("status", "created_at");
