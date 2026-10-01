import {
  type CompleteGithubRepositoryVerification,
  factoryConfigurationSchema,
  type GithubRepositoryVerification,
  githubRepositoryVerificationSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, GithubRepositoryVerification as VerificationRecord } from "@prisma/client";
import { PrismaService } from "../prisma.service";

function mapVerification(record: VerificationRecord): GithubRepositoryVerification {
  return githubRepositoryVerificationSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
  });
}

function sameName(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

@Injectable()
export class GithubRepositoryVerificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async request(): Promise<GithubRepositoryVerification> {
    return this.prisma.$transaction(
      async (transaction) => {
        const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
        if (!settings) throw new NotFoundException("Factory settings not initialized");
        const configuration = factoryConfigurationSchema.parse(settings.configuration);
        const { github } = configuration;
        if (github.state !== "CONNECTED") {
          throw new ConflictException("GitHub must be connected before repository verification");
        }
        if (github.owner === null || github.repository === null) {
          throw new ConflictException("GitHub repository target is not configured");
        }
        const active = await transaction.githubRepositoryVerification.findFirst({
          where: { status: { in: ["PENDING", "RUNNING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (active) {
          if (
            active.host === github.host &&
            active.owner === github.owner &&
            active.repository === github.repository &&
            active.baseBranch === github.baseBranch
          ) {
            return mapVerification(active);
          }
          throw new ConflictException("Another GitHub repository verification is active");
        }
        const verification = await transaction.githubRepositoryVerification.create({
          data: {
            host: github.host,
            owner: github.owner,
            repository: github.repository,
            baseBranch: github.baseBranch,
          },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: verification.id,
            eventType: "github.repository-verification.requested.v1",
            deduplicationKey: `github-repository-verification:${verification.id}:requested`,
            payload: {
              verificationId: verification.id,
              host: verification.host,
              owner: verification.owner,
              repository: verification.repository,
              baseBranch: verification.baseBranch,
            } satisfies Prisma.InputJsonValue,
          },
        });
        return mapVerification(verification);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async list(): Promise<GithubRepositoryVerification[]> {
    return (
      await this.prisma.githubRepositoryVerification.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(mapVerification);
  }

  async start(id: string, workerId: string): Promise<GithubRepositoryVerification> {
    const current = await this.prisma.githubRepositoryVerification.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("GitHub repository verification not found");
    if (current.status === "RUNNING" && current.workerId === workerId) {
      return mapVerification(current);
    }
    if (current.status !== "PENDING") {
      throw new ConflictException("GitHub repository verification is not pending");
    }
    return mapVerification(
      await this.prisma.githubRepositoryVerification.update({
        where: { id },
        data: { status: "RUNNING", workerId, startedAt: new Date() },
      }),
    );
  }

  async complete(
    id: string,
    input: CompleteGithubRepositoryVerification,
  ): Promise<GithubRepositoryVerification> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.githubRepositoryVerification.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("GitHub repository verification not found");
      if (["COMPLETED", "FAILED"].includes(current.status)) {
        const normalizedInvalidation =
          current.workerId === input.workerId &&
          current.status === "FAILED" &&
          input.status === "COMPLETED" &&
          [
            "GitHub repository configuration changed during verification",
            "GitHub repository evidence does not match the requested target",
          ].includes(current.message ?? "");
        const same =
          current.workerId === input.workerId &&
          current.status === input.status &&
          current.access === input.access &&
          current.observedOwner === input.observedOwner &&
          current.observedRepository === input.observedRepository &&
          current.defaultBranch === input.defaultBranch &&
          current.observedBaseBranch === input.observedBaseBranch &&
          current.isPrivate === input.isPrivate &&
          current.isArchived === input.isArchived &&
          current.message === input.message;
        if (!same && !normalizedInvalidation) {
          throw new ConflictException("GitHub repository verification already has another result");
        }
        return mapVerification(current);
      }
      if (current.status !== "RUNNING" || current.workerId !== input.workerId) {
        throw new ConflictException(
          "GitHub repository verification belongs to another worker or state",
        );
      }
      const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
      if (!settings) throw new NotFoundException("Factory settings not initialized");
      const github = factoryConfigurationSchema.parse(settings.configuration).github;
      const stale =
        github.state !== "CONNECTED" ||
        github.owner === null ||
        github.repository === null ||
        github.host !== current.host ||
        github.owner !== current.owner ||
        github.repository !== current.repository ||
        github.baseBranch !== current.baseBranch;
      const mismatchedEvidence =
        input.status === "COMPLETED" &&
        (input.observedOwner === null ||
          input.observedRepository === null ||
          input.observedBaseBranch === null ||
          !sameName(input.observedOwner, current.owner) ||
          !sameName(input.observedRepository, current.repository) ||
          input.observedBaseBranch !== current.baseBranch);
      if (stale || mismatchedEvidence) {
        return mapVerification(
          await transaction.githubRepositoryVerification.update({
            where: { id },
            data: {
              status: "FAILED",
              access: "UNAVAILABLE",
              observedOwner: null,
              observedRepository: null,
              defaultBranch: null,
              observedBaseBranch: null,
              isPrivate: null,
              isArchived: null,
              message: stale
                ? "GitHub repository configuration changed during verification"
                : "GitHub repository evidence does not match the requested target",
              completedAt: new Date(),
            },
          }),
        );
      }
      return mapVerification(
        await transaction.githubRepositoryVerification.update({
          where: { id },
          data: {
            status: input.status,
            access: input.access,
            observedOwner: input.observedOwner,
            observedRepository: input.observedRepository,
            defaultBranch: input.defaultBranch,
            observedBaseBranch: input.observedBaseBranch,
            isPrivate: input.isPrivate,
            isArchived: input.isArchived,
            message: input.message,
            completedAt: new Date(),
          },
        }),
      );
    });
  }
}
