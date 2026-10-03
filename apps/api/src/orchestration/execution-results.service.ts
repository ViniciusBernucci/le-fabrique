import { createHash } from "node:crypto";
import {
  executionResultReceiptSchema,
  executionResultReportSchema,
  type ReportExecutionResult,
  runDetailSchema,
  runListSchema,
  runSummarySchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ExecutionResultsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async report(attemptId: string, input: ReportExecutionResult) {
    const result = executionResultReportSchema.parse(input.result);
    if (result.workflowId !== attemptId)
      throw new ConflictException("Result belongs to another attempt");
    const digest = createHash("sha256").update(JSON.stringify(result)).digest("hex");
    return await this.prisma.$transaction(
      async (transaction) => {
        const attempt = await transaction.attempt.findUnique({
          where: { id: attemptId },
          include: { run: true },
        });
        if (!attempt) throw new NotFoundException("Attempt not found");
        if (
          attempt.workerId !== input.workerId ||
          attempt.fencingToken !== input.fencingToken ||
          attempt.run.nextFencingToken !== input.fencingToken
        ) {
          throw new ConflictException("Stale or foreign fencing token");
        }
        if (attempt.resultDigest && attempt.resultDigest !== digest)
          throw new ConflictException("Execution result is immutable");
        if (!attempt.resultDigest) {
          await transaction.attempt.update({
            where: { id: attemptId },
            data: { result: result as unknown as Prisma.InputJsonValue, resultDigest: digest },
          });
        }
        return executionResultReceiptSchema.parse({ attemptId, digest });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async list(projectId: string) {
    const runs = await this.prisma.run.findMany({
      where: { ticket: { projectId } },
      include: { ticket: { select: { projectId: true, title: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 50,
    });
    return runListSchema.parse(runs.map(mapSummary));
  }

  async detail(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        ticket: { select: { projectId: true, title: true } },
        attempts: { orderBy: { sequence: "desc" }, take: 50, include: { checkpoint: true } },
      },
    });
    if (!run) throw new NotFoundException("Run not found");
    return runDetailSchema.parse({
      ...mapSummary(run),
      attempts: run.attempts.map((attempt) => ({
        id: attempt.id,
        sequence: attempt.sequence,
        status: attempt.status,
        stoppedConfirmed: attempt.stoppedConfirmed,
        startedAt: attempt.startedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() ?? null,
        result: attempt.result ? executionResultReportSchema.parse(attempt.result) : null,
        resultDigest: attempt.resultDigest,
        checkpoint: attempt.checkpoint
          ? {
              baseRevision: attempt.checkpoint.baseRevision,
              codeRevision: attempt.checkpoint.codeRevision,
              snapshotId: attempt.checkpoint.snapshotId,
              patchHash: attempt.checkpoint.patchHash,
              stoppedConfirmed: attempt.checkpoint.stoppedConfirmed,
              reason: attempt.checkpoint.reason,
            }
          : null,
      })),
    });
  }
}

function mapSummary(run: {
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
