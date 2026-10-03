import { type RequestRunControl, runControlReceiptSchema } from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class RunControlService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async request(runId: string, input: RequestRunControl) {
    return this.prisma.$transaction(
      async (transaction) => {
        const run = await transaction.run.findUnique({ where: { id: runId } });
        if (!run) throw new NotFoundException("Run not found");
        const attempt = await transaction.attempt.findFirst({
          where: { runId },
          orderBy: { sequence: "desc" },
        });
        if (
          run.status !== "RUNNING" ||
          !attempt ||
          attempt.id !== input.attemptId ||
          attempt.fencingToken !== run.nextFencingToken ||
          attempt.status !== "RUNNING" ||
          attempt.stoppedConfirmed
        ) {
          throw new ConflictException("Control requires the current running writer");
        }
        if (run.controlAction && run.controlAction !== input.action)
          throw new ConflictException("Another control request is pending");
        if (!run.controlAction && run.version !== input.expectedVersion)
          throw new ConflictException("Run version changed");
        const updated = run.controlAction
          ? run
          : await transaction.run.update({
              where: { id: runId },
              data: { controlAction: input.action, version: { increment: 1 } },
            });
        return runControlReceiptSchema.parse({
          runId,
          attemptId: attempt.id,
          version: updated.version,
          action: input.action,
          pending: true,
        });
      },
      { isolationLevel: "Serializable" },
    );
  }
}
