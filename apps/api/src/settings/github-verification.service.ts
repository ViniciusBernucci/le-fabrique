import {
  type CompleteGithubVerification,
  type FactoryConfiguration,
  factoryConfigurationSchema,
  type GithubVerification,
  githubVerificationSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, GithubVerification as VerificationRecord } from "@prisma/client";
import { PrismaService } from "../prisma.service";

function mapVerification(record: VerificationRecord): GithubVerification {
  return githubVerificationSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
  });
}

@Injectable()
export class GithubVerificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async request(): Promise<GithubVerification> {
    return this.prisma.$transaction(
      async (transaction) => {
        const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
        if (!settings) throw new NotFoundException("Factory settings not initialized");
        const configuration = factoryConfigurationSchema.parse(settings.configuration);
        const activeOnboarding = await transaction.githubOnboardingSession.findFirst({
          where: { status: { in: ["PENDING", "RUNNING", "AWAITING_USER"] } },
        });
        if (activeOnboarding) {
          throw new ConflictException("GitHub onboarding is already active");
        }
        const active = await transaction.githubVerification.findFirst({
          where: { status: { in: ["PENDING", "RUNNING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (active) return mapVerification(active);
        const verification = await transaction.githubVerification.create({
          data: { host: configuration.github.host },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: verification.id,
            eventType: "github.verification.requested.v1",
            deduplicationKey: `github-verification:${verification.id}:requested`,
            payload: {
              verificationId: verification.id,
              host: verification.host,
            } satisfies Prisma.InputJsonValue,
          },
        });
        return mapVerification(verification);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async list(): Promise<GithubVerification[]> {
    return (
      await this.prisma.githubVerification.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(mapVerification);
  }

  async start(id: string, workerId: string): Promise<GithubVerification> {
    const current = await this.prisma.githubVerification.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("GitHub verification not found");
    if (current.status === "RUNNING" && current.workerId === workerId) {
      return mapVerification(current);
    }
    if (current.status !== "PENDING") {
      throw new ConflictException("GitHub verification is not pending");
    }
    return mapVerification(
      await this.prisma.githubVerification.update({
        where: { id },
        data: { status: "RUNNING", workerId, startedAt: new Date() },
      }),
    );
  }

  async complete(id: string, input: CompleteGithubVerification): Promise<GithubVerification> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.githubVerification.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("GitHub verification not found");
      if (["COMPLETED", "FAILED"].includes(current.status)) {
        const same =
          current.workerId === input.workerId &&
          current.status === input.status &&
          current.githubState === input.githubState &&
          current.cliVersion === input.cliVersion &&
          current.message === input.message;
        if (!same) throw new ConflictException("GitHub verification already has another result");
        return mapVerification(current);
      }
      if (current.status !== "RUNNING" || current.workerId !== input.workerId) {
        throw new ConflictException("GitHub verification belongs to another worker or state");
      }
      const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
      if (!settings) throw new NotFoundException("Factory settings not initialized");
      const configuration = factoryConfigurationSchema.parse(settings.configuration);
      if (configuration.github.host !== current.host) {
        return mapVerification(
          await transaction.githubVerification.update({
            where: { id },
            data: {
              status: "FAILED",
              githubState: "ERROR",
              cliVersion: null,
              message: "GitHub host changed during verification",
              completedAt: new Date(),
            },
          }),
        );
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
      return mapVerification(
        await transaction.githubVerification.update({
          where: { id },
          data: {
            status: input.status,
            githubState: input.githubState,
            cliVersion: input.cliVersion,
            message: input.message,
            completedAt: new Date(),
          },
        }),
      );
    });
  }
}
