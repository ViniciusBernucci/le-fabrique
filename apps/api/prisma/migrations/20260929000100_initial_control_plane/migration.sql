CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'READY', 'WAITING_WORKER', 'RUNNING', 'VALIDATING', 'REVIEW', 'DOCS', 'AWAITING_HUMAN', 'DONE', 'WAITING_PROVIDER', 'PAUSED_LIMIT', 'PAUSED_RESOURCE', 'BLOCKED_RECOVERY', 'AUTH_REQUIRED', 'FAILED', 'CANCELLED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

CREATE TABLE "projects" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "repo_url" TEXT NOT NULL,
  "base_ref" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tickets" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "acceptance_criteria" JSONB NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tickets_project_id_status_idx" ON "tickets"("project_id", "status");
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
