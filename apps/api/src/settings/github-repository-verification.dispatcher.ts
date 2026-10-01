import { githubRepositoryVerificationJobSchema } from "@le-fabrique/contracts";
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { ExecutionQueue } from "../orchestration/outbox-dispatcher";
import { PrismaService } from "../prisma.service";

export const GITHUB_REPOSITORY_VERIFICATION_QUEUE = Symbol("GITHUB_REPOSITORY_VERIFICATION_QUEUE");

@Injectable()
export class GithubRepositoryVerificationDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GITHUB_REPOSITORY_VERIFICATION_QUEUE) private readonly queue: ExecutionQueue,
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
      where: { status: "PENDING", eventType: "github.repository-verification.requested.v1" },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    let published = 0;
    for (const event of events) {
      try {
        const payload = githubRepositoryVerificationJobSchema.parse({
          schemaVersion: 1,
          eventId: event.id,
          ...(event.payload as Record<string, unknown>),
        });
        await this.queue.add("github.repository.verify.v1", payload, {
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
          data: { status: event.attempts >= 4 ? "FAILED" : "PENDING", attempts: { increment: 1 } },
        });
      }
    }
    return published;
  }
}
