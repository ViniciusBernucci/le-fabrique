CREATE TYPE "WorkerStatus" AS ENUM ('ONLINE', 'OFFLINE');

CREATE TABLE "worker_identities" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" "WorkerStatus" NOT NULL DEFAULT 'ONLINE',
  "capabilities" JSONB NOT NULL,
  "os" TEXT NOT NULL,
  "arch" TEXT NOT NULL,
  "node_version" TEXT NOT NULL,
  "last_heartbeat_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "worker_identities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_identities_status_last_heartbeat_at_idx" ON "worker_identities"("status", "last_heartbeat_at");
