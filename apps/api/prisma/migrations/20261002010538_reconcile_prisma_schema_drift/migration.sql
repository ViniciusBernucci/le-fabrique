-- Prisma generates uuid() values in the client; these columns intentionally have no database default.
ALTER TABLE "attempts" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "checkpoints" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "provider_verifications" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "runs" ALTER COLUMN "id" DROP DEFAULT;

ALTER INDEX "github_repository_verifications_target_created_at_idx"
  RENAME TO "github_repository_verifications_host_owner_repository_base__idx";
