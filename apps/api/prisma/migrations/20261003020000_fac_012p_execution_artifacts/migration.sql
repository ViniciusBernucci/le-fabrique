ALTER TABLE "attempts"
ADD COLUMN "artifact" JSONB,
ADD COLUMN "artifact_digest" TEXT;
