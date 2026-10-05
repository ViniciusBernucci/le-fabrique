import { randomUUID } from "node:crypto";
import {
  orchestrationJobSchema,
  type RequestRunResume,
  runSummarySchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { stoppedResumeEvidence } from "./resume-evidence";

@Injectable()
export class RunResumeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async request(runId: string, input: RequestRunResume) {
    return this.prisma.$transaction(
      async (tx) => {
        const run = await tx.run.findUnique({ where: { id: runId }, include: { ticket: true } });
        if (!run) throw new NotFoundException("Run not found");
        const event = await tx.outboxEvent.findUnique({ where: { id: run.dispatchEventId } });
        if (!event) throw new ConflictException("Immutable dispatch event missing");
        const previousJob = orchestrationJobSchema
          .strict()
          .parse({ schemaVersion: 1, eventId: event.id, ...(event.payload as object) });
        if (
          run.status === "WAITING_WORKER" &&
          previousJob.resumeFrom?.attemptId === input.attemptId &&
          previousJob.resumeFrom.artifactDigest === input.artifactDigest
        )
          return summary(run);
        if (
          run.version !== input.expectedVersion ||
          run.controlAction ||
          !["WAITING_PROVIDER", "PAUSED", "PAUSED_LIMIT", "FAILED", "CANCELLED"].includes(
            run.status,
          ) ||
          run.ticket.status !== run.status
        )
          throw new ConflictException("Run cannot resume at this version/state");
        const attempt = await tx.attempt.findFirst({
          where: { runId },
          orderBy: { sequence: "desc" },
          include: { checkpoint: true },
        });
        if (
          !attempt ||
          attempt.id !== input.attemptId ||
          attempt.fencingToken !== run.nextFencingToken
        )
          throw new ConflictException("Resume requires the latest fenced attempt");
        const resumeFrom = stoppedResumeEvidence(attempt);
        if (
          resumeFrom.artifactDigest !== input.artifactDigest ||
          previousJob.ticketId !== run.ticketId ||
          previousJob.projectId !== run.ticket.projectId
        )
          throw new ConflictException("Resume target changed");
        const eventId = randomUUID();
        const job = orchestrationJobSchema.strict().parse({ ...previousJob, eventId, resumeFrom });
        const { eventId: _eventId, ...payload } = job;
        await tx.outboxEvent.create({
          data: {
            id: eventId,
            aggregateId: runId,
            eventType: "run.resume.v1",
            deduplicationKey: `run:${runId}:resume:${attempt.id}`,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.ticket.update({
          where: { id: run.ticketId },
          data: { status: "WAITING_WORKER", version: { increment: 1 } },
        });
        const updated = await tx.run.update({
          where: { id: runId },
          data: { status: "WAITING_WORKER", dispatchEventId: eventId, version: { increment: 1 } },
          include: { ticket: true },
        });
        return summary(updated);
      },
      { isolationLevel: "Serializable" },
    );
  }
}
function summary(run: {
  id: string;
  ticketId: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  ticket: { projectId: string; title: string };
}) {
  return runSummarySchema.parse({
    id: run.id,
    ticketId: run.ticketId,
    projectId: run.ticket.projectId,
    title: run.ticket.title,
    status: run.status,
    version: run.version,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  });
}
