import {
  type CompleteGithubOnboarding,
  type FactoryConfiguration,
  factoryConfigurationSchema,
  type GithubOnboardingChallenge,
  type GithubOnboardingSession,
  githubOnboardingChallengeSchema,
  githubOnboardingSessionSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { GithubOnboardingSession as OnboardingRecord, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { RedisService } from "../redis.service";

const SESSION_TTL_MS = 10 * 60 * 1_000;
const challengeKey = (id: string) => `github-onboarding:${id}:challenge`;

function mapSession(record: OnboardingRecord): GithubOnboardingSession {
  return githubOnboardingSessionSchema.parse({
    ...record,
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
  });
}

@Injectable()
export class GithubOnboardingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async request(): Promise<GithubOnboardingSession> {
    return this.prisma.$transaction(
      async (transaction) => {
        const now = new Date();
        await transaction.githubOnboardingSession.updateMany({
          where: {
            status: { in: ["PENDING", "RUNNING", "AWAITING_USER"] },
            expiresAt: { lte: now },
          },
          data: { status: "EXPIRED", message: "Login window expired", completedAt: now },
        });
        const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
        if (!settings) throw new NotFoundException("Factory settings not initialized");
        const configuration = factoryConfigurationSchema.parse(settings.configuration);
        if (configuration.github.state !== "AUTH_REQUIRED") {
          throw new ConflictException("GitHub configuration does not require authentication");
        }
        const activeVerification = await transaction.githubVerification.findFirst({
          where: { status: { in: ["PENDING", "RUNNING"] } },
        });
        if (activeVerification) {
          throw new ConflictException("GitHub verification is already active");
        }
        const active = await transaction.githubOnboardingSession.findFirst({
          where: { status: { in: ["PENDING", "RUNNING", "AWAITING_USER"] } },
          orderBy: { createdAt: "desc" },
        });
        if (active) return mapSession(active);
        const session = await transaction.githubOnboardingSession.create({
          data: {
            host: configuration.github.host,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: session.id,
            eventType: "github.onboarding.requested.v1",
            deduplicationKey: `github-onboarding:${session.id}:requested`,
            payload: {
              sessionId: session.id,
              host: session.host,
              expiresAt: session.expiresAt.toISOString(),
            } satisfies Prisma.InputJsonValue,
          },
        });
        return mapSession(session);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async list(): Promise<GithubOnboardingSession[]> {
    const now = new Date();
    await this.prisma.githubOnboardingSession.updateMany({
      where: {
        status: { in: ["PENDING", "RUNNING", "AWAITING_USER"] },
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED", message: "Login window expired", completedAt: now },
    });
    return (
      await this.prisma.githubOnboardingSession.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(mapSession);
  }

  async start(id: string, workerId: string): Promise<GithubOnboardingSession> {
    const current = await this.prisma.githubOnboardingSession.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("GitHub onboarding session not found");
    if (current.status === "RUNNING" && current.workerId === workerId) return mapSession(current);
    if (current.expiresAt <= new Date()) {
      return mapSession(
        await this.prisma.githubOnboardingSession.update({
          where: { id },
          data: { status: "EXPIRED", message: "Login window expired", completedAt: new Date() },
        }),
      );
    }
    if (current.status !== "PENDING")
      throw new ConflictException("GitHub onboarding is not pending");
    return mapSession(
      await this.prisma.githubOnboardingSession.update({
        where: { id },
        data: { status: "RUNNING", workerId, startedAt: new Date() },
      }),
    );
  }

  async publishChallenge(
    id: string,
    workerId: string,
    input: GithubOnboardingChallenge,
  ): Promise<GithubOnboardingSession> {
    const challenge = githubOnboardingChallengeSchema.parse(input);
    const current = await this.prisma.githubOnboardingSession.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("GitHub onboarding session not found");
    if (!["RUNNING", "AWAITING_USER"].includes(current.status) || current.workerId !== workerId) {
      throw new ConflictException("GitHub onboarding belongs to another worker or state");
    }
    const settings = await this.prisma.factorySettings.findUnique({ where: { id: "global" } });
    if (!settings) throw new NotFoundException("Factory settings not initialized");
    const configuration = factoryConfigurationSchema.parse(settings.configuration);
    const challengeHost = new URL(challenge.verificationUri).hostname.toLowerCase();
    if (
      configuration.github.host !== current.host ||
      challengeHost !== current.host.toLowerCase()
    ) {
      throw new ConflictException("GitHub host changed or challenge host does not match");
    }
    const remainingMs = current.expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) throw new ConflictException("GitHub onboarding session expired");
    const expiresAt = new Date(challenge.expiresAt);
    if (expiresAt.getTime() > current.expiresAt.getTime() || expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("GitHub challenge expiration is outside the session window");
    }
    const session =
      current.status === "AWAITING_USER"
        ? current
        : await this.prisma.githubOnboardingSession.update({
            where: { id },
            data: { status: "AWAITING_USER", message: "Waiting for GitHub device authorization" },
          });
    await this.redis.ensureConnected();
    const ttlSeconds = Math.max(
      1,
      Math.min(600, Math.ceil((expiresAt.getTime() - Date.now()) / 1_000)),
    );
    await this.redis.set(challengeKey(id), JSON.stringify(challenge), "EX", ttlSeconds);
    return mapSession(session);
  }

  async getChallenge(id: string): Promise<GithubOnboardingChallenge> {
    const session = await this.prisma.githubOnboardingSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException("GitHub onboarding session not found");
    if (!["RUNNING", "AWAITING_USER"].includes(session.status)) {
      throw new NotFoundException("GitHub onboarding challenge is not available");
    }
    const settings = await this.prisma.factorySettings.findUnique({ where: { id: "global" } });
    if (!settings) throw new NotFoundException("Factory settings not initialized");
    const configuration = factoryConfigurationSchema.parse(settings.configuration);
    if (configuration.github.host !== session.host) {
      throw new NotFoundException("GitHub onboarding challenge is not available");
    }
    await this.redis.ensureConnected();
    const value = await this.redis.get(challengeKey(id));
    if (!value) throw new NotFoundException("GitHub onboarding challenge is not available");
    return githubOnboardingChallengeSchema.parse(JSON.parse(value));
  }

  async complete(id: string, input: CompleteGithubOnboarding): Promise<GithubOnboardingSession> {
    const session = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.githubOnboardingSession.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("GitHub onboarding session not found");
      if (["COMPLETED", "FAILED", "EXPIRED"].includes(current.status)) {
        const same =
          current.workerId === input.workerId &&
          current.status === input.status &&
          current.githubState === input.githubState &&
          current.credentialStorage === input.credentialStorage &&
          current.message === input.message;
        if (!same) throw new ConflictException("GitHub onboarding already has another result");
        return current;
      }
      if (
        !["RUNNING", "AWAITING_USER"].includes(current.status) ||
        current.workerId !== input.workerId
      ) {
        throw new ConflictException("GitHub onboarding belongs to another worker or state");
      }
      const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
      if (!settings) throw new NotFoundException("Factory settings not initialized");
      const configuration = factoryConfigurationSchema.parse(settings.configuration);
      if (configuration.github.host !== current.host) {
        return transaction.githubOnboardingSession.update({
          where: { id },
          data: {
            status: "FAILED",
            githubState: "ERROR",
            credentialStorage: "UNKNOWN",
            message: "GitHub host changed during login",
            completedAt: new Date(),
          },
        });
      }
      const updatedConfiguration: FactoryConfiguration = {
        ...configuration,
        github: { ...configuration.github, state: input.githubState },
      };
      await transaction.factorySettings.update({
        where: { id: "global" },
        data: {
          configuration: updatedConfiguration as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      return transaction.githubOnboardingSession.update({
        where: { id },
        data: {
          status: input.status,
          githubState: input.githubState,
          credentialStorage: input.credentialStorage,
          message: input.message,
          completedAt: new Date(),
        },
      });
    });
    try {
      await this.redis.ensureConnected();
      await this.redis.del(challengeKey(id));
    } catch {
      // The challenge still expires by its bounded Redis TTL.
    }
    return mapSession(session);
  }
}
