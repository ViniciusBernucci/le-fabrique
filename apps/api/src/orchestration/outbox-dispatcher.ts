import { orchestrationJobSchema } from "@le-fabrique/contracts";
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export const ORCHESTRATION_QUEUE = Symbol("ORCHESTRATION_QUEUE");

export interface ExecutionQueue {
  add(
    name: string,
    payload: unknown,
    options: { jobId: string; removeOnComplete: boolean; removeOnFail: boolean },
  ): Promise<unknown>;
  close(): Promise<void>;
}

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ORCHESTRATION_QUEUE) private readonly queue: ExecutionQueue,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.dispatchOnce(), 1_000);
    this.timer.unref();
    void this.dispatchOnce();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.queue.close();
  }

  async dispatchOnce(): Promise<number> {
    const events = await this.prisma.outboxEvent.findMany({
      where: { status: "PENDING", eventType: { in: ["ticket.ready.v1", "run.resume.v1"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    let published = 0;
    for (const event of events) {
      try {
        const storedPayload = event.payload as Record<string, unknown>;
        const payload = orchestrationJobSchema.parse({
          schemaVersion: 1,
          eventId: event.id,
          ...storedPayload,
          ticketVersion: storedPayload.ticketVersion ?? storedPayload.version,
          baseRevision: storedPayload.baseRevision ?? null,
          executionSpecification: storedPayload.executionSpecification ?? null,
        });
        if (payload.baseRevision === null) {
          throw new Error("Ticket execution requires an exact base revision");
        }
        if (payload.executionSpecification === null) {
          throw new Error("Ticket execution requires an immutable execution specification");
        }
        await this.queue.add("ticket.execute.v1", payload, {
          jobId: event.id,
          removeOnComplete: false,
          removeOnFail: false,
        });
        const updated = await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, status: "PENDING" },
          data: { status: "PUBLISHED", publishedAt: new Date(), attempts: { increment: 1 } },
        });
        published += updated.count;
      } catch {
        await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, status: "PENDING" },
          data: {
            status: event.attempts >= 4 ? "FAILED" : "PENDING",
            attempts: { increment: 1 },
          },
        });
      }
    }
    return published;
  }
}
