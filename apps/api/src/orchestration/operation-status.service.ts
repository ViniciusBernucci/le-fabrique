import { operationStatusSchema } from "@le-fabrique/contracts";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { hasGlobalWriterGuard } from "./global-writer-guard";

@Injectable()
export class OperationStatusService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read() {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const now = new Date();
          const workers = await transaction.workerIdentity.findMany({
            orderBy: { id: "asc" },
            take: 101,
            select: { id: true, name: true, status: true, lastHeartbeatAt: true },
          });
          const unresolvedWriterCount = await transaction.attempt.count({
            where: { stoppedConfirmed: false },
          });
          const writers = await transaction.attempt.findMany({
            where: { stoppedConfirmed: false },
            orderBy: { id: "asc" },
            take: 10,
            select: { id: true, runId: true, workerId: true, leaseExpiresAt: true },
          });
          const writerGuardInstalled = await hasGlobalWriterGuard(transaction);
          return operationStatusSchema.parse({
            observedAt: now.toISOString(),
            heartbeatMaxAgeMs: 180_000,
            workersTruncated: workers.length > 100,
            workers: workers.slice(0, 100).map((worker) => {
              const age = now.getTime() - worker.lastHeartbeatAt.getTime();
              return {
                id: worker.id,
                name: worker.name,
                lastHeartbeatAt: worker.lastHeartbeatAt.toISOString(),
                heartbeatState:
                  worker.status === "OFFLINE"
                    ? "OFFLINE"
                    : age < 0
                      ? "CLOCK_SKEW"
                      : age <= 180_000
                        ? "RECENT"
                        : "STALE",
              };
            }),
            writerGuardInstalled,
            unresolvedWriterCount,
            writers: writers.map((writer) => ({
              attemptId: writer.id,
              runId: writer.runId,
              workerId: writer.workerId,
              leaseExpiresAt: writer.leaseExpiresAt.toISOString(),
              leaseState: writer.leaseExpiresAt > now ? "ACTIVE" : "EXPIRED",
            })),
          });
        },
        { isolationLevel: "RepeatableRead" },
      );
    } catch {
      throw new ServiceUnavailableException("Factory operation state is unavailable");
    }
  }
}
