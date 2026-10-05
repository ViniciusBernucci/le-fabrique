-- One unconfirmed writer across the whole factory, irrespective of run/worker/lease/status.
-- Existing conflicting attempts deliberately make migration fail; never fabricate stop proof.
CREATE UNIQUE INDEX "attempts_single_unconfirmed_writer"
ON "attempts" ((1)) WHERE "stopped_confirmed" = false;
