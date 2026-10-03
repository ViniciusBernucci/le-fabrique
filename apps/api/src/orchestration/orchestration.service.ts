import { createHash } from "node:crypto";
import type {
  OrchestrationCheckpointRequest,
  OrchestrationClaim,
  OrchestrationClaimRequest,
  OrchestrationCompleteRequest,
  OrchestrationLeaseRequest,
  OrchestrationReconcileRequest,
  OrchestrationState,
} from "@le-fabrique/contracts";
import {
  executionArtifactSchema,
  executionResultReportSchema,
  orchestrationClaimSchema,
  orchestrationJobSchema,
  orchestrationStateSchema,
  verifyExecutionArtifact,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type Attempt, Prisma, type Run } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { hasGlobalWriterGuard } from "./global-writer-guard";
import { stoppedResumeEvidence } from "./resume-evidence";

type AttemptWithRun = Attempt & { run: Run; checkpoint?: { stoppedConfirmed: boolean } | null };

@Injectable()
export class OrchestrationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async claim(input: OrchestrationClaimRequest): Promise<OrchestrationClaim> {
    const now = new Date();
    const result = await this.prisma.$transaction(
      async (transaction) => {
        const worker = await transaction.workerIdentity.findUnique({
          where: { id: input.workerId },
        });
        if (worker?.status !== "ONLINE") throw new NotFoundException("Worker unavailable");
        const ticket = await transaction.ticket.findUnique({ where: { id: input.ticketId } });
        if (!ticket) throw new NotFoundException("Ticket not found");
        if (ticket.projectId !== input.projectId) {
          throw new ConflictException("Ticket belongs to another project");
        }
        let run = await transaction.run.findUnique({ where: { dispatchEventId: input.eventId } });
        if (!run) {
          if (ticket.status !== "READY" || ticket.version !== input.ticketVersion) {
            throw new ConflictException("Ticket is not claimable at this version");
          }
          run = await transaction.run.create({
            data: { ticketId: ticket.id, dispatchEventId: input.eventId },
          });
        } else if (run.ticketId !== input.ticketId) {
          throw new ConflictException("Dispatch event belongs to another ticket");
        }

        if (input.resumeFrom) {
          const event = await transaction.outboxEvent.findUnique({ where: { id: input.eventId } });
          if (event?.eventType !== "run.resume.v1")
            throw new ConflictException("Resume intent is not authorized");
          const frozen = orchestrationJobSchema
            .strict()
            .parse({ schemaVersion: 1, eventId: event.id, ...(event.payload as object) });
          const { workerId: _worker, leaseDurationMs: _lease, ...job } = input;
          if (JSON.stringify(orchestrationJobSchema.strict().parse(job)) !== JSON.stringify(frozen))
            throw new ConflictException("Resume job differs from the authorized immutable intent");
        }

        const latest = await transaction.attempt.findFirst({
          where: { runId: run.id },
          orderBy: { sequence: "desc" },
        });
        const active = latest?.status === "RUNNING" ? latest : null;
        if (active) {
          if (active.leaseExpiresAt > now) {
            if (active.workerId !== input.workerId) {
              throw new ConflictException("Run already has an active writer");
            }
            return { claim: mapClaim(active, true), blocked: false };
          }
          if (!active.stoppedConfirmed) {
            await transaction.run.update({
              where: { id: run.id },
              data: { status: "BLOCKED_RECOVERY", version: { increment: 1 } },
            });
            await transaction.ticket.update({
              where: { id: ticket.id },
              data: { status: "BLOCKED_RECOVERY", version: { increment: 1 } },
            });
            return { claim: null, blocked: true };
          }
        }
        const isResumeOrigin = latest && input.resumeFrom?.attemptId === latest.id;
        if (isResumeOrigin) {
          if (
            run.status !== "WAITING_WORKER" ||
            ticket.status !== "WAITING_WORKER" ||
            !latest.stoppedConfirmed ||
            latest.fencingToken !== run.nextFencingToken
          )
            throw new ConflictException("Resume origin is not safely claimable");
          const origin = await transaction.attempt.findUnique({
            where: { id: latest.id },
            include: { checkpoint: true },
          });
          if (
            !origin ||
            JSON.stringify(stoppedResumeEvidence(origin)) !== JSON.stringify(input.resumeFrom)
          )
            throw new ConflictException("Resume origin evidence changed");
        } else if (latest) {
          return { claim: mapClaim(latest, true), blocked: false };
        } else if (input.resumeFrom) {
          throw new ConflictException("Resume origin is missing");
        }

        if (!(await hasGlobalWriterGuard(transaction)))
          throw new ConflictException("Global writer guard migration is unavailable");

        // Lease expiry, worker identity and terminal labels do not prove physical stop.
        // The partial unique PostgreSQL index also closes concurrent claim races.
        const unresolvedWriters = await transaction.attempt.findMany({
          where: { stoppedConfirmed: false },
          select: { id: true },
          take: 1,
        });
        if (unresolvedWriters.length > 0)
          throw new ConflictException("Global writer termination is not confirmed");

        const fencingToken = run.nextFencingToken + 1;
        const attempt = await transaction.attempt
          .create({
            data: {
              runId: run.id,
              workerId: input.workerId,
              sequence: fencingToken,
              fencingToken,
              leaseExpiresAt: new Date(now.getTime() + input.leaseDurationMs),
            },
          })
          .catch((error: unknown) => {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
              throw new ConflictException("Global writer already claimed concurrently");
            throw error;
          });
        await transaction.run.update({
          where: { id: run.id },
          data: {
            status: "RUNNING",
            nextFencingToken: fencingToken,
            version: { increment: 1 },
          },
        });
        await transaction.ticket.update({
          where: { id: ticket.id },
          data: { status: "RUNNING", version: { increment: 1 } },
        });
        return { claim: mapClaim(attempt, false), blocked: false };
      },
      { isolationLevel: "Serializable" },
    );
    if (result.blocked || !result.claim) {
      throw new ConflictException("Previous writer termination is not confirmed");
    }
    return result.claim;
  }

  async renew(attemptId: string, input: OrchestrationLeaseRequest): Promise<OrchestrationClaim> {
    const now = new Date();
    return this.prisma.$transaction(
      async (transaction) => {
        const attempt = await this.currentAttempt(transaction, attemptId, input);
        if (attempt.status !== "RUNNING" || attempt.leaseExpiresAt <= now) {
          throw new ConflictException("Lease already expired");
        }
        const updated = await transaction.attempt.update({
          where: { id: attempt.id },
          data: { leaseExpiresAt: new Date(now.getTime() + input.leaseDurationMs) },
        });
        return {
          ...mapClaim(updated, false),
          controlAction: attempt.run.controlAction as "PAUSE" | "CANCEL" | null,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async checkpoint(
    attemptId: string,
    input: OrchestrationCheckpointRequest,
  ): Promise<OrchestrationState> {
    return this.prisma.$transaction(async (transaction) => {
      const attempt = await this.currentAttempt(transaction, attemptId, input, true);
      const existing = await transaction.checkpoint.findUnique({ where: { attemptId } });
      const data = {
        attemptId,
        baseRevision: input.baseRevision,
        codeRevision: input.codeRevision,
        snapshotId: input.snapshotId,
        patchHash: input.patchHash,
        reason: input.reason,
        stoppedConfirmed: input.stoppedConfirmed,
      };
      if (existing) {
        const same = Object.entries(data).every(
          ([key, value]) => existing[key as keyof typeof existing] === value,
        );
        if (!same) throw new ConflictException("Checkpoint already exists with other content");
      } else {
        await transaction.checkpoint.create({ data });
      }
      if (input.stoppedConfirmed && !attempt.stoppedConfirmed) {
        await transaction.attempt.update({
          where: { id: attempt.id },
          data: { stoppedConfirmed: true, status: "STOPPED" },
        });
      }
      return orchestrationStateSchema.parse({
        runId: attempt.runId,
        attemptId,
        status: "RUNNING",
        stoppedConfirmed: input.stoppedConfirmed,
      });
    });
  }

  async complete(
    attemptId: string,
    input: OrchestrationCompleteRequest,
  ): Promise<OrchestrationState> {
    return this.prisma.$transaction(
      async (transaction) => await this.completeTransaction(transaction, attemptId, input),
      { isolationLevel: "Serializable" },
    );
  }

  async reconcile(attemptId: string, input: OrchestrationReconcileRequest) {
    return this.prisma.$transaction(
      async (transaction) => {
        const attempt = await this.currentAttempt(transaction, attemptId, input, true);
        const checkpoint = await transaction.checkpoint.findUnique({ where: { attemptId } });
        if (
          !attempt.stoppedConfirmed ||
          !checkpoint?.stoppedConfirmed ||
          checkpoint.reason === "PROGRESS"
        )
          return { state: null };
        const outcome =
          checkpoint.reason === "WAITING_PROVIDER"
            ? "WAITING_PROVIDER"
            : checkpoint.reason === "COMPLETED"
              ? "VALIDATING"
              : checkpoint.reason === "OPERATOR_PAUSED"
                ? "PAUSED"
                : checkpoint.reason === "PAUSED"
                  ? "PAUSED_LIMIT"
                  : checkpoint.reason === "CANCELLED"
                    ? "CANCELLED"
                    : "FAILED";
        if (
          attempt.result ||
          outcome === "VALIDATING" ||
          outcome === "PAUSED_LIMIT" ||
          outcome === "WAITING_PROVIDER" ||
          (outcome === "PAUSED" && checkpoint.snapshotId)
        ) {
          const parsed = executionResultReportSchema.safeParse(attempt.result);
          if (!parsed.success)
            throw new ConflictException("Recovery requires a valid persisted result");
          const result = parsed.data;
          const digest = createHash("sha256").update(JSON.stringify(result)).digest("hex");
          const snapshot = result.snapshots.at(-1);
          const expectedOutcome =
            result.status === "WAITING_PROVIDER"
              ? "WAITING_PROVIDER"
              : result.status === "CANCELLED"
                ? "CANCELLED"
                : result.status === "AWAITING_HUMAN" &&
                    result.reason === "APPROVED" &&
                    result.review?.verdict === "APPROVE"
                  ? "VALIDATING"
                  : result.status === "PAUSED"
                    ? "PAUSED"
                    : result.status === "PAUSED_LIMIT"
                      ? "PAUSED_LIMIT"
                      : "FAILED";
          if (
            result.workflowId !== attemptId ||
            attempt.resultDigest !== digest ||
            expectedOutcome !== outcome ||
            result.checks.some((check) => !check.stoppedConfirmed) ||
            checkpoint.snapshotId !== (snapshot?.snapshotId ?? null) ||
            checkpoint.patchHash !== (snapshot?.manifestHash ?? null) ||
            (snapshot &&
              (checkpoint.baseRevision !== snapshot.baseRevision ||
                checkpoint.codeRevision !== snapshot.headRevision))
          )
            throw new ConflictException("Persisted result does not match checkpoint");
          if (attempt.run.status === "BLOCKED_RECOVERY" && snapshot) {
            const artifact = executionArtifactSchema.parse(attempt.artifact);
            verifyExecutionArtifact(
              artifact,
              (encoded) => Buffer.from(encoded, "base64"),
              (bytes) => createHash("sha256").update(bytes).digest("hex"),
            );
            const { untracked, ...manifest } = artifact.manifest;
            const projected = { ...manifest, untrackedFiles: untracked.length };
            if (
              createHash("sha256").update(JSON.stringify(artifact)).digest("hex") !==
                attempt.artifactDigest ||
              Object.keys(projected).some(
                (key) =>
                  projected[key as keyof typeof projected] !==
                  snapshot[key as keyof typeof snapshot],
              )
            )
              throw new ConflictException(
                "Blocked recovery artifact does not match the stopped result",
              );
          }
        }
        return {
          state: await this.completeTransaction(
            transaction,
            attemptId,
            { ...input, outcome },
            true,
          ),
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async completeTransaction(
    transaction: Prisma.TransactionClient,
    attemptId: string,
    input: OrchestrationCompleteRequest,
    reconciledStop = false,
  ): Promise<OrchestrationState> {
    const attempt = await this.currentAttempt(transaction, attemptId, input, true);
    const checkpoint = await transaction.checkpoint.findUnique({ where: { attemptId } });
    if (!checkpoint?.stoppedConfirmed) {
      throw new ConflictException("Completion requires a stopped checkpoint");
    }
    if (attempt.run.status === input.outcome && attempt.status !== "RUNNING") {
      return orchestrationStateSchema.parse({
        runId: attempt.runId,
        attemptId,
        status: input.outcome,
        stoppedConfirmed: true,
      });
    }
    const provenBlocked =
      reconciledStop && attempt.run.status === "BLOCKED_RECOVERY" && attempt.stoppedConfirmed;
    if (
      (attempt.run.status !== "RUNNING" && !provenBlocked) ||
      !["RUNNING", "STOPPED"].includes(attempt.status)
    ) {
      throw new ConflictException("Completion cannot rewrite terminal or human-controlled state");
    }
    const attemptStatus =
      input.outcome === "VALIDATING"
        ? "COMPLETED"
        : input.outcome === "CANCELLED"
          ? "CANCELLED"
          : input.outcome === "WAITING_PROVIDER" ||
              input.outcome === "PAUSED_LIMIT" ||
              input.outcome === "PAUSED"
            ? "STOPPED"
            : "FAILED";
    await transaction.attempt.update({
      where: { id: attemptId },
      data: { status: attemptStatus, stoppedConfirmed: true, completedAt: new Date() },
    });
    await transaction.run.update({
      where: { id: attempt.runId },
      data: { status: input.outcome, controlAction: null, version: { increment: 1 } },
    });
    await transaction.ticket.update({
      where: { id: attempt.run.ticketId },
      data: { status: input.outcome, version: { increment: 1 } },
    });
    return orchestrationStateSchema.parse({
      runId: attempt.runId,
      attemptId,
      status: input.outcome,
      stoppedConfirmed: true,
    });
  }

  private async currentAttempt(
    transaction: Prisma.TransactionClient,
    attemptId: string,
    input: { workerId: string; fencingToken: number },
    allowStopped = false,
  ): Promise<AttemptWithRun> {
    const attempt = await transaction.attempt.findUnique({
      where: { id: attemptId },
      include: { run: true },
    });
    if (!attempt) throw new NotFoundException("Attempt not found");
    if (
      attempt.workerId !== input.workerId ||
      attempt.fencingToken !== input.fencingToken ||
      attempt.run.nextFencingToken !== input.fencingToken ||
      (!allowStopped && attempt.status !== "RUNNING") ||
      (allowStopped &&
        !["RUNNING", "STOPPED", "COMPLETED", "FAILED", "CANCELLED"].includes(attempt.status))
    ) {
      throw new ConflictException("Stale or foreign fencing token");
    }
    return attempt;
  }
}

function mapClaim(attempt: Attempt, replayed: boolean): OrchestrationClaim {
  return orchestrationClaimSchema.parse({
    runId: attempt.runId,
    attemptId: attempt.id,
    workerId: attempt.workerId,
    fencingToken: attempt.fencingToken,
    leaseExpiresAt: attempt.leaseExpiresAt.toISOString(),
    replayed,
  });
}
