import { createHash } from "node:crypto";
import {
  type ApproveGithubPullRequest,
  type CompleteGithubPullRequest,
  factoryConfigurationSchema,
  type GithubPullRequest,
  githubBranchNameSchema,
  githubOwnerNameSchema,
  githubPullRequestSchema,
  githubRepositoryNameSchema,
  type PrepareGithubPullRequest,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, GithubPullRequest as PullRequestRecord } from "@prisma/client";
import { PrismaService } from "../prisma.service";

function mapPullRequest(record: PullRequestRecord): GithubPullRequest {
  return githubPullRequestSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    approvedAt: record.approvedAt?.toISOString() ?? null,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
  });
}

function digestPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function exactPullRequestUrl(
  value: string,
  host: string,
  owner: string,
  repository: string,
  number: number,
): boolean {
  try {
    const url = new URL(value);
    const expectedPath = `/${owner}/${repository}/pull/${number}`.toLowerCase();
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === host.toLowerCase() &&
      url.pathname.replace(/\/$/, "").toLowerCase() === expectedPath &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

@Injectable()
export class GithubPullRequestService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async eligibleTarget(transaction: Prisma.TransactionClient) {
    const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
    if (!settings) throw new NotFoundException("Factory settings not initialized");
    const github = factoryConfigurationSchema.parse(settings.configuration).github;
    if (
      github.state !== "CONNECTED" ||
      !github.pullRequestCreationEnabled ||
      github.owner === null ||
      github.repository === null
    ) {
      throw new ConflictException("GitHub pull request creation is not eligible");
    }
    const owner = githubOwnerNameSchema.safeParse(github.owner);
    const repository = githubRepositoryNameSchema.safeParse(github.repository);
    const baseBranch = githubBranchNameSchema.safeParse(github.baseBranch);
    if (!owner.success || !repository.success || !baseBranch.success) {
      throw new ConflictException("GitHub pull request target contains unsupported names");
    }
    const readable = await transaction.githubRepositoryVerification.findFirst({
      where: {
        host: github.host,
        owner: github.owner,
        repository: github.repository,
        baseBranch: github.baseBranch,
        status: "COMPLETED",
        access: "READABLE",
      },
      orderBy: { completedAt: "desc" },
    });
    if (!readable) {
      throw new ConflictException("A matching readable repository verification is required");
    }
    return {
      ...github,
      owner: owner.data,
      repository: repository.data,
      baseBranch: baseBranch.data,
    };
  }

  async prepare(input: PrepareGithubPullRequest): Promise<GithubPullRequest> {
    return this.prisma.$transaction(
      async (transaction) => {
        const github = await this.eligibleTarget(transaction);
        if (input.headBranch === github.baseBranch) {
          throw new ConflictException("Pull request head must differ from the base branch");
        }
        const immutable = {
          host: github.host,
          owner: github.owner,
          repository: github.repository,
          baseBranch: github.baseBranch,
          headBranch: input.headBranch,
          title: input.title,
          body: input.body,
          draft: input.draft,
        };
        const active = await transaction.githubPullRequest.findFirst({
          where: { status: { in: ["PREPARED", "APPROVED", "RUNNING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (active) {
          const same = Object.entries(immutable).every(
            ([key, value]) => active[key as keyof typeof immutable] === value,
          );
          if (same) return mapPullRequest(active);
          throw new ConflictException("Another GitHub pull request request is active");
        }
        return mapPullRequest(
          await transaction.githubPullRequest.create({
            data: { ...immutable, approvalDigest: digestPayload(immutable) },
          }),
        );
      },
      { isolationLevel: "Serializable" },
    );
  }

  async list(): Promise<GithubPullRequest[]> {
    return (
      await this.prisma.githubPullRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    ).map(mapPullRequest);
  }

  async approve(id: string, input: ApproveGithubPullRequest): Promise<GithubPullRequest> {
    return this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.githubPullRequest.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("GitHub pull request request not found");
        if (
          ["APPROVED", "RUNNING", "COMPLETED"].includes(current.status) &&
          current.approvalDigest === input.approvalDigest
        ) {
          return mapPullRequest(current);
        }
        if (
          current.status !== "PREPARED" ||
          current.version !== input.expectedVersion ||
          current.approvalDigest !== input.approvalDigest
        ) {
          throw new ConflictException(
            "Pull request approval is stale or does not match the payload",
          );
        }
        const github = await this.eligibleTarget(transaction);
        if (
          github.host !== current.host ||
          github.owner !== current.owner ||
          github.repository !== current.repository ||
          github.baseBranch !== current.baseBranch
        ) {
          throw new ConflictException("GitHub target changed after pull request preparation");
        }
        const updated = await transaction.githubPullRequest.update({
          where: { id },
          data: { status: "APPROVED", version: { increment: 1 }, approvedAt: new Date() },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: updated.id,
            eventType: "github.pull-request.requested.v1",
            deduplicationKey: `github-pull-request:${updated.id}:approved`,
            payload: {
              requestId: updated.id,
              approvalDigest: updated.approvalDigest,
              host: updated.host,
              owner: updated.owner,
              repository: updated.repository,
              baseBranch: updated.baseBranch,
              headBranch: updated.headBranch,
              title: updated.title,
              body: updated.body,
              draft: updated.draft,
            } satisfies Prisma.InputJsonValue,
          },
        });
        return mapPullRequest(updated);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async cancel(id: string, expectedVersion: number): Promise<GithubPullRequest> {
    const updated = await this.prisma.githubPullRequest.updateMany({
      where: { id, status: "PREPARED", version: expectedVersion },
      data: { status: "CANCELLED", version: { increment: 1 }, cancelledAt: new Date() },
    });
    if (updated.count !== 1)
      throw new ConflictException("Only the current prepared request can cancel");
    const record = await this.prisma.githubPullRequest.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("GitHub pull request request not found");
    return mapPullRequest(record);
  }

  async start(id: string, workerId: string): Promise<GithubPullRequest> {
    const current = await this.prisma.githubPullRequest.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("GitHub pull request request not found");
    if (current.status === "RUNNING" && current.workerId === workerId)
      return mapPullRequest(current);
    if (current.status !== "APPROVED") throw new ConflictException("Pull request is not approved");
    return mapPullRequest(
      await this.prisma.githubPullRequest.update({
        where: { id },
        data: { status: "RUNNING", workerId, startedAt: new Date() },
      }),
    );
  }

  async complete(id: string, input: CompleteGithubPullRequest): Promise<GithubPullRequest> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.githubPullRequest.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("GitHub pull request request not found");
      if (["COMPLETED", "FAILED"].includes(current.status)) {
        const normalizedInvalidation =
          current.workerId === input.workerId &&
          current.status === "FAILED" &&
          input.status === "COMPLETED" &&
          current.message === "GitHub pull request target changed during execution";
        const same =
          current.workerId === input.workerId &&
          current.status === input.status &&
          current.disposition === input.disposition &&
          current.pullRequestNumber === input.pullRequestNumber &&
          current.pullRequestUrl === input.pullRequestUrl &&
          current.message === input.message;
        if (!same && !normalizedInvalidation) {
          throw new ConflictException("GitHub pull request already has another result");
        }
        return mapPullRequest(current);
      }
      if (current.status !== "RUNNING" || current.workerId !== input.workerId) {
        throw new ConflictException("GitHub pull request belongs to another worker or state");
      }
      const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
      if (!settings) throw new NotFoundException("Factory settings not initialized");
      const github = factoryConfigurationSchema.parse(settings.configuration).github;
      const stale =
        github.state !== "CONNECTED" ||
        !github.pullRequestCreationEnabled ||
        github.host !== current.host ||
        github.owner !== current.owner ||
        github.repository !== current.repository ||
        github.baseBranch !== current.baseBranch;
      const invalidUrl =
        input.status === "COMPLETED" &&
        (input.pullRequestUrl === null ||
          input.pullRequestNumber === null ||
          !exactPullRequestUrl(
            input.pullRequestUrl,
            current.host,
            current.owner,
            current.repository,
            input.pullRequestNumber,
          ));
      if (stale || invalidUrl) {
        return mapPullRequest(
          await transaction.githubPullRequest.update({
            where: { id },
            data: {
              status: "FAILED",
              disposition: null,
              pullRequestNumber: null,
              pullRequestUrl: null,
              message: stale
                ? "GitHub pull request target changed during execution"
                : "GitHub pull request result did not match the approved target",
              completedAt: new Date(),
            },
          }),
        );
      }
      return mapPullRequest(
        await transaction.githubPullRequest.update({
          where: { id },
          data: {
            status: input.status,
            disposition: input.disposition,
            pullRequestNumber: input.pullRequestNumber,
            pullRequestUrl: input.pullRequestUrl,
            message: input.message,
            completedAt: new Date(),
          },
        }),
      );
    });
  }
}
