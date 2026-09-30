CREATE TYPE "RunStatus" AS ENUM ('WAITING_WORKER', 'RUNNING', 'VALIDATING', 'PAUSED_LIMIT', 'BLOCKED_RECOVERY', 'FAILED', 'CANCELLED');
CREATE TYPE "AttemptStatus" AS ENUM ('RUNNING', 'STOPPED', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL,
  "dispatch_event_id" UUID NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'WAITING_WORKER',
  "version" INTEGER NOT NULL DEFAULT 1,
  "next_fencing_token" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "runs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "worker_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "fencing_token" INTEGER NOT NULL,
  "status" "AttemptStatus" NOT NULL DEFAULT 'RUNNING',
  "lease_expires_at" TIMESTAMP(3) NOT NULL,
  "stopped_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attempts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "checkpoints" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id" UUID NOT NULL,
  "base_revision" TEXT NOT NULL,
  "code_revision" TEXT,
  "snapshot_id" UUID,
  "patch_hash" TEXT,
  "reason" TEXT NOT NULL,
  "stopped_confirmed" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkpoints_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "runs_ticket_id_key" ON "runs"("ticket_id");
CREATE UNIQUE INDEX "runs_dispatch_event_id_key" ON "runs"("dispatch_event_id");
CREATE INDEX "runs_status_updated_at_idx" ON "runs"("status", "updated_at");
CREATE UNIQUE INDEX "attempts_run_id_sequence_key" ON "attempts"("run_id", "sequence");
CREATE UNIQUE INDEX "attempts_run_id_fencing_token_key" ON "attempts"("run_id", "fencing_token");
CREATE INDEX "attempts_run_id_status_lease_expires_at_idx" ON "attempts"("run_id", "status", "lease_expires_at");
CREATE UNIQUE INDEX "checkpoints_attempt_id_key" ON "checkpoints"("attempt_id");
