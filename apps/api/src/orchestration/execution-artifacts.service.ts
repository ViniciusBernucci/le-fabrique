import { createHash } from "node:crypto";
import {
  type ExecutionArtifact,
  executionArtifactSchema,
  executionArtifactStateSchema,
  executionResultReceiptSchema,
  executionResultReportSchema,
  verifyExecutionArtifact,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ExecutionArtifactsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async report(
    attemptId: string,
    input: { workerId: string; fencingToken: number; artifact: ExecutionArtifact },
  ) {
    const artifact = executionArtifactSchema.parse(input.artifact);
    verifyExecutionArtifact(
      artifact,
      (value) => Buffer.from(value, "base64"),
      (bytes) => createHash("sha256").update(bytes).digest("hex"),
    );
    const digest = createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
    return this.prisma.$transaction(
      async (transaction) => {
        const attempt = await transaction.attempt.findUnique({
          where: { id: attemptId },
          include: {
            run: {
              include: { ticket: { include: { project: { select: { organizationId: true } } } } },
            },
          },
        });
        if (!attempt) throw new NotFoundException("Attempt not found");
        if (
          attempt.workerId !== input.workerId ||
          attempt.fencingToken !== input.fencingToken ||
          attempt.run.nextFencingToken !== input.fencingToken
        )
          throw new ConflictException("Stale or foreign fencing token");
        const result = executionResultReportSchema.parse(attempt.result);
        const snapshot = result.snapshots.at(-1);
        const { untracked, ...manifest } = artifact.manifest;
        const projected = { ...manifest, untrackedFiles: untracked.length };
        if (
          result.workflowId !== attemptId ||
          !snapshot ||
          Object.keys(projected).some(
            (key) =>
              projected[key as keyof typeof projected] !== snapshot[key as keyof typeof snapshot],
          )
        )
          throw new ConflictException("Artifact does not match execution result");
        if (attempt.artifactDigest && attempt.artifactDigest !== digest)
          throw new ConflictException("Execution artifact is immutable");
        if (!attempt.artifactDigest && attempt.run.ticket?.project?.organizationId) {
          const org = attempt.run.ticket.project.organizationId;
          await transaction.$queryRaw`SELECT id FROM account_organizations WHERE id=${org}::uuid FOR UPDATE`;
          const reservation = await transaction.accountStorageReservation.findUnique({
            where: { attemptId },
          });
          const size = Number(
            (
              await transaction.$queryRaw<
                { bytes: number }[]
              >`SELECT octet_length(${JSON.stringify(artifact)}::jsonb::text) AS bytes`
            )[0]?.bytes ?? 0,
          );
          if (!reservation || size > Number(reservation.bytes))
            throw new ConflictException("Artifact storage reservation missing or insufficient");
        }
        if (!attempt.artifactDigest)
          await transaction.attempt.update({
            where: { id: attemptId },
            data: {
              artifact: artifact as unknown as Prisma.InputJsonValue,
              artifactDigest: digest,
            },
          });
        if (attempt.run.ticket?.project?.organizationId)
          await transaction.accountStorageReservation.deleteMany({ where: { attemptId } });
        return executionResultReceiptSchema.parse({ attemptId, digest });
      },
      { isolationLevel: "Serializable" },
    );
  }
  async get(runId: string, attemptId: string) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, runId },
      select: { artifact: true },
    });
    if (!attempt) throw new NotFoundException("Attempt not found in run");
    const artifact = attempt.artifact ? executionArtifactSchema.parse(attempt.artifact) : null;
    if (artifact)
      verifyExecutionArtifact(
        artifact,
        (value) => Buffer.from(value, "base64"),
        (bytes) => createHash("sha256").update(bytes).digest("hex"),
      );
    return executionArtifactStateSchema.parse({ artifact });
  }
}
