CREATE TYPE "ProviderVerificationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "provider_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "installation_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "ProviderVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "worker_id" UUID,
  "provider_state" TEXT,
  "cli_version" TEXT,
  "observed_models" JSONB NOT NULL DEFAULT '[]',
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "provider_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_verifications_installation_id_created_at_idx"
  ON "provider_verifications"("installation_id", "created_at");
CREATE INDEX "provider_verifications_status_created_at_idx"
  ON "provider_verifications"("status", "created_at");
