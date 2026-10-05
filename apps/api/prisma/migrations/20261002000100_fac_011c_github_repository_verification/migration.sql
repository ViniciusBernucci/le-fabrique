CREATE TYPE "GithubRepositoryVerificationStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "github_repository_verifications" (
  "id" UUID NOT NULL,
  "host" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "repository" TEXT NOT NULL,
  "base_branch" TEXT NOT NULL,
  "status" "GithubRepositoryVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "worker_id" UUID,
  "access" TEXT,
  "observed_owner" TEXT,
  "observed_repository" TEXT,
  "default_branch" TEXT,
  "observed_base_branch" TEXT,
  "is_private" BOOLEAN,
  "is_archived" BOOLEAN,
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "github_repository_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "github_repository_verifications_status_created_at_idx"
  ON "github_repository_verifications"("status", "created_at");

CREATE INDEX "github_repository_verifications_target_created_at_idx"
  ON "github_repository_verifications"(
    "host",
    "owner",
    "repository",
    "base_branch",
    "created_at"
  );
