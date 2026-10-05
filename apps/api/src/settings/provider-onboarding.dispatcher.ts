import { providerOnboardingJobSchema } from "@le-fabrique/contracts";
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { ExecutionQueue } from "../orchestration/outbox-dispatcher";
import { PrismaService } from "../prisma.service";

export const PROVIDER_ONBOARDING_QUEUE = Symbol("PROVIDER_ONBOARDING_QUEUE");

@Injectable()
export class ProviderOnboardingDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PROVIDER_ONBOARDING_QUEUE) private readonly queue: ExecutionQueue,
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
      where: { status: "PENDING", eventType: "provider.onboarding.requested.v1" },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    let published = 0;
    for (const event of events) {
      try {
        const payload = providerOnboardingJobSchema.parse({
          schemaVersion: 1,
          eventId: event.id,
          ...(event.payload as Record<string, unknown>),
        });
        await this.queue.add("provider.onboarding.v1", payload, {
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
