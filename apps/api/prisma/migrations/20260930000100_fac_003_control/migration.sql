ALTER TABLE "outbox_events" ADD COLUMN "deduplication_key" TEXT;
UPDATE "outbox_events" SET "deduplication_key" = "id"::text WHERE "deduplication_key" IS NULL;
ALTER TABLE "outbox_events" ALTER COLUMN "deduplication_key" SET NOT NULL;
CREATE UNIQUE INDEX "outbox_events_deduplication_key_key" ON "outbox_events"("deduplication_key");
