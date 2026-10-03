-- Additive result evidence only; reporting never releases a writer.
ALTER TABLE "attempts" ADD COLUMN "result" JSONB,
                       ADD COLUMN "result_digest" TEXT;
