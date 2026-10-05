import { randomUUID } from "node:crypto";
import {
  finalizationRecoveryJobSchema,
  orchestrationJobSchema,
  type RequestRunRecovery,
  runRecoveryReceiptSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class RunRecoveryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async request(runId: string, input: RequestRunRecovery) {
    return this.prisma.$transaction(
      async (tx) => {
        const key = `run:${runId}:finalization:${input.attemptId}:v${input.expectedVersion}`;
        const existing = await tx.outboxEvent.findUnique({ where: { deduplicationKey: key } });
        if (existing) {
          const job = finalizationRecoveryJobSchema.parse({
            ...(existing.payload as object),
            eventId: existing.id,
          });
          if (job.runId !== runId || job.attemptId !== input.attemptId)
            throw new ConflictException("Recovery intent belongs to another attempt");
          return runRecoveryReceiptSchema.parse({
            runId,
            attemptId: input.attemptId,
            eventId: existing.id,
            status: "REQUESTED",
          });
        }
        const run = await tx.run.findUnique({ where: { id: runId } });
        if (!run) throw new NotFoundException("Run not found");
        if (
          run.version !== input.expectedVersion ||
          !["RUNNING", "BLOCKED_RECOVERY"].includes(run.status)
        )
          throw new ConflictException("Recovery requires a pending execution at this version");
        const attempt = await tx.attempt.findFirst({
          where: { runId },
          orderBy: { sequence: "desc" },
        });
        if (
          !attempt ||
          attempt.id !== input.attemptId ||
          attempt.fencingToken !== run.nextFencingToken
        )
          throw new ConflictException("Recovery requires the current fenced attempt");
        const original = await tx.outboxEvent.findUnique({ where: { id: run.dispatchEventId } });
        if (!original || !["ticket.ready.v1", "run.resume.v1"].includes(original.eventType))
          throw new ConflictException("Original immutable job missing");
        const originalJob = orchestrationJobSchema
          .strict()
          .parse({ schemaVersion: 1, ...(original.payload as object), eventId: original.id });
        if (originalJob.ticketId !== run.ticketId)
          throw new ConflictException("Original job belongs to another run");
        const eventId = randomUUID();
        const job = finalizationRecoveryJobSchema.parse({
          schemaVersion: 1,
          mode: "FINALIZATION_ONLY",
          eventId,
          runId,
          attemptId: attempt.id,
          workerId: attempt.workerId,
          fencingToken: attempt.fencingToken,
          originalJob,
        });
        const { eventId: _eventId, ...payload } = job;
        await tx.outboxEvent.create({
          data: {
            id: eventId,
            aggregateId: runId,
            eventType: "run.finalization-recovery.v1",
            deduplicationKey: key,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.run.update({ where: { id: runId }, data: { version: { increment: 1 } } });
        return runRecoveryReceiptSchema.parse({
          runId,
          attemptId: attempt.id,
          eventId,
          status: "REQUESTED",
        });
      },
      { isolationLevel: "Serializable" },
    );
  }
}
