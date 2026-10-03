ALTER TYPE "TicketStatus" ADD VALUE 'PAUSED';
ALTER TYPE "RunStatus" ADD VALUE 'PAUSED';
ALTER TABLE "runs" ADD COLUMN "control_action" TEXT;
ALTER TABLE "runs" ADD CONSTRAINT "runs_control_action_check"
  CHECK ("control_action" IS NULL OR "control_action" IN ('PAUSE', 'CANCEL'));
