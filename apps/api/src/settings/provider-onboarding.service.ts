import {
  type CompleteProviderOnboarding,
  type FactoryConfiguration,
  factoryConfigurationSchema,
  type ProviderOnboardingChallenge,
  type ProviderOnboardingSession,
  providerAuthorizationCodeSchema,
  providerOnboardingChallengeSchema,
  providerOnboardingSessionSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ProviderOnboardingSession as OnboardingRecord, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { RedisService } from "../redis.service";

const SESSION_TTL_MS = 10 * 60 * 1_000;
const challengeKey = (id: string) => `provider-onboarding:${id}:challenge`;

function mapSession(record: OnboardingRecord): ProviderOnboardingSession {
  return providerOnboardingSessionSchema.parse({
    ...record,
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
  });
}

@Injectable()
export class ProviderOnboardingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async request(installationId: string): Promise<ProviderOnboardingSession> {
    return this.prisma.$transaction(
      async (transaction) => {
        const now = new Date();
        await transaction.providerOnboardingSession.updateMany({
          where: {
            installationId,
            status: { in: ["PENDING", "RUNNING", "AWAITING_USER"] },
            expiresAt: { lte: now },
          },
          data: { status: "EXPIRED", message: "Login window expired", completedAt: now },
        });
        const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
        if (!settings) throw new NotFoundException("Factory settings not initialized");
        const configuration = factoryConfigurationSchema.parse(settings.configuration);
        const installation = configuration.installations.find((item) => item.id === installationId);
        if (!installation) throw new NotFoundException("Provider installation not found");
        if (installation.authMode !== "SUBSCRIPTION_CLI")
          throw new ConflictException(
            "CLI onboarding and verification require a subscription installation",
          );
        if (!installation.enabled) {
          throw new ConflictException("Only an enabled installation supports managed login");
        }
        if (installation.state !== "AUTH_REQUIRED") {
          throw new ConflictException("Provider installation does not require authentication");
        }
        const active = await transaction.providerOnboardingSession.findFirst({
          where: { installationId, status: { in: ["PENDING", "RUNNING", "AWAITING_USER"] } },
          orderBy: { createdAt: "desc" },
        });
        if (active) return mapSession(active);
        const session = await transaction.providerOnboardingSession.create({
          data: {
            installationId,
            provider: installation.provider,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: session.id,
            eventType: "provider.onboarding.requested.v1",
            deduplicationKey: `provider-onboarding:${session.id}:requested`,
            payload: {
              sessionId: session.id,
              installationId,
              provider: installation.provider,
              expiresAt: session.expiresAt.toISOString(),
            } satisfies Prisma.InputJsonValue,
          },
        });
        return mapSession(session);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async list(): Promise<ProviderOnboardingSession[]> {
    const now = new Date();
    await this.prisma.providerOnboardingSession.updateMany({
      where: {
        status: { in: ["PENDING", "RUNNING", "AWAITING_USER"] },
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED", message: "Login window expired", completedAt: now },
    });
    return (
      await this.prisma.providerOnboardingSession.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(mapSession);
  }

  async start(id: string, workerId: string): Promise<ProviderOnboardingSession> {
    const current = await this.prisma.providerOnboardingSession.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Provider onboarding session not found");
    if (current.status === "RUNNING" && current.workerId === workerId) return mapSession(current);
    if (current.expiresAt <= new Date()) {
      return mapSession(
        await this.prisma.providerOnboardingSession.update({
          where: { id },
          data: {
            status: "EXPIRED",
            message: "Login window expired",
            completedAt: new Date(),
          },
        }),
      );
    }
    if (current.status !== "PENDING") throw new ConflictException("Onboarding is not pending");
    return mapSession(
      await this.prisma.providerOnboardingSession.update({
        where: { id },
        data: { status: "RUNNING", workerId, startedAt: new Date() },
      }),
    );
  }

  async publishChallenge(
    id: string,
    workerId: string,
    input: ProviderOnboardingChallenge,
  ): Promise<ProviderOnboardingSession> {
    const challenge = providerOnboardingChallengeSchema.parse(input);
    const current = await this.prisma.providerOnboardingSession.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Provider onboarding session not found");
    if (!["RUNNING", "AWAITING_USER"].includes(current.status) || current.workerId !== workerId) {
      throw new ConflictException("Onboarding belongs to another worker or state");
    }
    if (
      current.provider === "CODEX"
        ? challenge.flow !== undefined
        : challenge.flow !== "AUTHORIZATION_CODE" || challenge.provider !== current.provider
    )
      throw new ConflictException("Challenge provider mismatch");
    const remainingMs = current.expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) throw new ConflictException("Onboarding session expired");
    const expiresAt = new Date(challenge.expiresAt);
    if (expiresAt.getTime() > current.expiresAt.getTime() || expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("Challenge expiration is outside the session window");
    }
    const session =
      current.status === "AWAITING_USER"
        ? current
        : await this.prisma.providerOnboardingSession.update({
            where: { id },
            data: { status: "AWAITING_USER", message: "Waiting for official device authorization" },
          });
    await this.redis.ensureConnected();
    const ttlSeconds = Math.max(
      1,
      Math.min(600, Math.ceil((expiresAt.getTime() - Date.now()) / 1_000)),
    );
    await this.redis.set(challengeKey(id), JSON.stringify(challenge), "EX", ttlSeconds);
    return mapSession(session);
  }

  async getChallenge(id: string): Promise<ProviderOnboardingChallenge> {
    const session = await this.prisma.providerOnboardingSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException("Provider onboarding session not found");
    if (!["RUNNING", "AWAITING_USER"].includes(session.status)) {
      throw new NotFoundException("Onboarding challenge is not available");
    }
    await this.redis.ensureConnected();
    const value = await this.redis.get(challengeKey(id));
    if (!value) throw new NotFoundException("Onboarding challenge is not available");
    return providerOnboardingChallengeSchema.parse(JSON.parse(value));
  }

  async submitAuthorizationCode(id: string, code: string): Promise<{ accepted: true }> {
    const input = providerAuthorizationCodeSchema.parse({ code });
    const session = await this.prisma.providerOnboardingSession.findUnique({ where: { id } });
    if (
      session?.status !== "AWAITING_USER" ||
      session.provider === "CODEX" ||
      session.expiresAt.getTime() <= Date.now()
    )
      throw new ConflictException("Authorization session is not awaiting a code");
    const challenge = await this.getChallenge(id);
    if (challenge.flow !== "AUTHORIZATION_CODE" || challenge.provider !== session.provider)
      throw new ConflictException("Authorization challenge mismatch");
    const ttl = Math.max(
      1,
      Math.min(600, Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000)),
    );
    const stored = await this.redis.set(
      `provider-onboarding:${id}:response`,
      input.code,
      "EX",
      ttl,
      "NX",
    );
    if (!stored) throw new ConflictException("Authorization code already pending");
    return { accepted: true };
  }

  async takeAuthorizationCode(id: string, workerId: string): Promise<{ code: string | null }> {
    const session = await this.prisma.providerOnboardingSession.findUnique({ where: { id } });
    if (
      !session ||
      session.workerId !== workerId ||
      session.provider === "CODEX" ||
      !["RUNNING", "AWAITING_USER"].includes(session.status) ||
      session.expiresAt.getTime() <= Date.now()
    )
      throw new ConflictException("Authorization session does not belong to this worker");
    await this.redis.ensureConnected();
    const code = await this.redis.getdel(`provider-onboarding:${id}:response`);
    return { code: code === null ? null : providerAuthorizationCodeSchema.parse({ code }).code };
  }

  async complete(
    id: string,
    input: CompleteProviderOnboarding,
  ): Promise<ProviderOnboardingSession> {
    const session = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.providerOnboardingSession.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Provider onboarding session not found");
      if (["COMPLETED", "FAILED", "EXPIRED"].includes(current.status)) {
        const same =
          current.workerId === input.workerId &&
          current.status === input.status &&
          current.providerState === input.providerState &&
          current.message === input.message;
        if (!same) throw new ConflictException("Onboarding already has another result");
        return current;
      }
      if (
        !["RUNNING", "AWAITING_USER"].includes(current.status) ||
        current.workerId !== input.workerId
      ) {
        throw new ConflictException("Onboarding belongs to another worker or state");
      }
      const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
      if (!settings) throw new NotFoundException("Factory settings not initialized");
      const configuration = factoryConfigurationSchema.parse(settings.configuration);
      const installationIndex = configuration.installations.findIndex(
        (item) => item.id === current.installationId,
      );
      const installation = configuration.installations[installationIndex];
      if (
        installation?.provider !== current.provider ||
        installation.authMode !== "SUBSCRIPTION_CLI"
      ) {
        throw new ConflictException("Provider installation changed during onboarding");
      }
      const updatedConfiguration: FactoryConfiguration = {
        ...configuration,
        installations: configuration.installations.map((item, index) =>
          index === installationIndex ? { ...item, state: input.providerState } : item,
        ),
      };
      await transaction.factorySettings.update({
        where: { id: "global" },
        data: {
          configuration: updatedConfiguration as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      return transaction.providerOnboardingSession.update({
        where: { id },
        data: {
          status: input.status,
          providerState: input.providerState,
          message: input.message,
          completedAt: new Date(),
        },
      });
    });
    try {
      await this.redis.ensureConnected();
      await this.redis.del(challengeKey(id));
      await this.redis.del(`provider-onboarding:${id}:response`);
    } catch {
      // The challenge still expires by its bounded Redis TTL.
    }
    return mapSession(session);
  }
}
