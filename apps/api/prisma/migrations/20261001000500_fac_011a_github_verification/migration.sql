CREATE TYPE "GithubVerificationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "github_verifications" (
  "id" UUID NOT NULL,
  "host" TEXT NOT NULL,
  "status" "GithubVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "worker_id" UUID,
  "github_state" TEXT,
  "cli_version" TEXT,
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "github_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "github_verifications_status_created_at_idx"
  ON "github_verifications"("status", "created_at");
