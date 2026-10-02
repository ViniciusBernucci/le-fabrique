CREATE TYPE "GithubPullRequestStatus" AS ENUM (
  'PREPARED',
  'APPROVED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "github_pull_requests" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "host" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "repository" TEXT NOT NULL,
  "base_branch" TEXT NOT NULL,
  "head_branch" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "draft" BOOLEAN NOT NULL DEFAULT true,
  "approval_digest" TEXT NOT NULL,
  "status" "GithubPullRequestStatus" NOT NULL DEFAULT 'PREPARED',
  "worker_id" UUID,
  "disposition" TEXT,
  "pull_request_number" INTEGER,
  "pull_request_url" TEXT,
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  CONSTRAINT "github_pull_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "github_pull_requests_status_created_at_idx"
  ON "github_pull_requests"("status", "created_at");

CREATE INDEX "github_pull_requests_target_created_at_idx"
  ON "github_pull_requests"(
    "host",
    "owner",
    "repository",
    "base_branch",
    "head_branch",
    "created_at"
  );
