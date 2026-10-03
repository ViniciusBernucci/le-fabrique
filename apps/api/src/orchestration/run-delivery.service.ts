import { createHash } from "node:crypto";
import {
  type ApproveRunDelivery,
  executionArtifactSchema,
  executionResultReportSchema,
  executionSpecificationSchema,
  redactExecutionReportText,
  runDeliveryApprovalSchema,
  runDeliverySchema,
  runDeliveryStateSchema,
  runSummarySchema,
  verifyExecutionArtifact,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const text = (value: string) =>
  redactExecutionReportText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");

@Injectable()
export class RunDeliveryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(runId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const run = await this.load(tx, runId);
        return await this.build(tx, run);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async approve(runId: string, input: ApproveRunDelivery) {
    return this.prisma.$transaction(
      async (tx) => {
        const run = await this.load(tx, runId);
        const state = await this.build(tx, run);
        if (
          !state.delivery ||
          state.delivery.attemptId !== input.attemptId ||
          state.delivery.deliveryDigest !== input.deliveryDigest
        )
          throw new ConflictException("Delivery evidence changed or is not eligible");
        if (state.accepted && run.status === "DONE") return summary(run);
        if (
          run.version !== input.expectedVersion ||
          run.status !== "VALIDATING" ||
          run.ticket.status !== "VALIDATING"
        )
          throw new ConflictException("Run version or state changed");
        const approval = runDeliveryApprovalSchema.parse({
          delivery: state.delivery,
          acceptedAt: new Date().toISOString(),
        });
        const updated = await tx.run.update({
          where: { id: runId, version: input.expectedVersion },
          data: {
            status: "DONE",
            approval: approval as unknown as Prisma.InputJsonValue,
            version: { increment: 1 },
          },
        });
        await tx.ticket.update({
          where: { id: run.ticketId },
          data: { status: "DONE", version: { increment: 1 } },
        });
        return summary({ ...run, ...updated });
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async load(tx: Prisma.TransactionClient, runId: string) {
    const run = await tx.run.findUnique({
      where: { id: runId },
      include: {
        ticket: true,
        attempts: { orderBy: { sequence: "desc" }, take: 1, include: { checkpoint: true } },
      },
    });
    if (!run) throw new NotFoundException("Run not found");
    return run;
  }

  private async build(
    tx: Prisma.TransactionClient,
    run: Awaited<ReturnType<RunDeliveryService["load"]>>,
  ) {
    const blocked = (reason: "STATE_NOT_READY" | "EVIDENCE_MISSING" | "EVIDENCE_MISMATCH") =>
      runDeliveryStateSchema.parse({ delivery: null, accepted: false, reason });
    if (run.status === "DONE" && run.approval) {
      const approval = runDeliveryApprovalSchema.parse(run.approval);
      const { deliveryDigest, ...core } = approval.delivery;
      const latest = run.attempts[0];
      const currentResult = executionResultReportSchema.safeParse(latest?.result);
      const currentArtifact = executionArtifactSchema.safeParse(latest?.artifact);
      if (
        !latest?.stoppedConfirmed ||
        latest.status !== "COMPLETED" ||
        !currentResult.success ||
        !currentArtifact.success ||
        (currentResult.success &&
          digest(JSON.stringify(currentResult.data)) !== core.resultDigest) ||
        (currentArtifact.success &&
          digest(JSON.stringify(currentArtifact.data)) !== core.artifactDigest) ||
        latest.checkpoint?.patchHash !== core.patchHash ||
        latest.checkpoint?.baseRevision !== core.baseRevision ||
        latest.checkpoint?.codeRevision !== core.codeRevision ||
        latest.fencingToken !== run.nextFencingToken ||
        latest.id !== core.attemptId ||
        latest.resultDigest !== core.resultDigest ||
        latest.artifactDigest !== core.artifactDigest ||
        core.runId !== run.id ||
        digest(core.documentMarkdown) !== core.documentDigest ||
        digest(JSON.stringify(core)) !== deliveryDigest
      )
        return blocked("EVIDENCE_MISMATCH");
      return runDeliveryStateSchema.parse({
        delivery: approval.delivery,
        accepted: true,
        reason: null,
      });
    }
    if (run.status !== "VALIDATING" || run.ticket.status !== "VALIDATING")
      return blocked("STATE_NOT_READY");
    const attempt = run.attempts[0];
    if (
      !attempt?.result ||
      !attempt.artifact ||
      !attempt.checkpoint ||
      !attempt.resultDigest ||
      !attempt.artifactDigest
    )
      return blocked("EVIDENCE_MISSING");
    const resultParsed = executionResultReportSchema.safeParse(attempt.result);
    const artifactParsed = executionArtifactSchema.safeParse(attempt.artifact);
    if (!resultParsed.success || !artifactParsed.success) return blocked("EVIDENCE_MISMATCH");
    const result = resultParsed.data;
    const artifact = artifactParsed.data;
    const checkpoint = attempt.checkpoint;
    try {
      verifyExecutionArtifact(artifact, (base64) => Buffer.from(base64, "base64"), digest);
    } catch {
      return blocked("EVIDENCE_MISMATCH");
    }
    const snapshot = result.snapshots.at(-1);
    const { untracked, ...artifactManifest } = artifact.manifest;
    const projected = { ...artifactManifest, untrackedFiles: untracked.length };
    if (
      attempt.status !== "COMPLETED" ||
      !attempt.stoppedConfirmed ||
      attempt.fencingToken !== run.nextFencingToken ||
      !checkpoint.stoppedConfirmed ||
      checkpoint.reason !== "COMPLETED" ||
      result.workflowId !== attempt.id ||
      result.status !== "AWAITING_HUMAN" ||
      result.reason !== "APPROVED" ||
      result.review?.verdict !== "APPROVE" ||
      !snapshot ||
      !checkpoint.codeRevision ||
      checkpoint.snapshotId !== snapshot.snapshotId ||
      checkpoint.patchHash !== snapshot.manifestHash ||
      checkpoint.baseRevision !== snapshot.baseRevision ||
      checkpoint.codeRevision !== snapshot.headRevision ||
      digest(JSON.stringify(result)) !== attempt.resultDigest ||
      digest(JSON.stringify(artifact)) !== attempt.artifactDigest ||
      Object.keys(projected).some(
        (key) =>
          projected[key as keyof typeof projected] !== snapshot[key as keyof typeof snapshot],
      ) ||
      result.checks.some((check) => !check.stoppedConfirmed) ||
      !result.runtimeObservations.some(
        (call) => call.role === "DEVELOPER" && call.status === "COMPLETED",
      ) ||
      !result.runtimeObservations.some(
        (call) => call.role === "REVIEWER" && call.status === "COMPLETED",
      )
    )
      return blocked("EVIDENCE_MISMATCH");
    const event = await tx.outboxEvent.findUnique({ where: { id: run.dispatchEventId } });
    const specification = executionSpecificationSchema.safeParse(
      (event?.payload as Record<string, unknown> | undefined)?.executionSpecification,
    );
    if (
      !event ||
      !["ticket.ready.v1", "run.resume.v1"].includes(event.eventType) ||
      !specification.success
    )
      return blocked("EVIDENCE_MISSING");
    const spec = specification.data;
    if (
      spec.ticket.id !== run.ticketId ||
      spec.project.id !== run.ticket.projectId ||
      spec.project.baseRevision !== checkpoint.baseRevision
    )
      return blocked("EVIDENCE_MISMATCH");
    const checks = spec.project.definition.executionProfile?.approvedChecks;
    if (
      !checks?.length ||
      checks.some((command) => {
        const baseline = result.checks.find(
          (check) => check.phase === "BASELINE" && check.name === command.name,
        );
        const post = result.checks
          .filter((check) => check.phase === "POST_CHANGE" && check.name === command.name)
          .sort((a, b) => b.round - a.round)[0];
        return (
          !baseline ||
          !post ||
          post.status !== "COMPLETED" ||
          (post.exitCode !== 0 &&
            !(post.preExisting && (baseline.exitCode !== 0 || baseline.status !== "COMPLETED")))
        );
      })
    )
      return blocked("EVIDENCE_MISMATCH");
    const documentMarkdown = [
      `# Entrega — ${text(spec.ticket.title)}`,
      "",
      "## Objetivo",
      "",
      text(spec.ticket.objective),
      "",
      "## Critérios para confirmação humana",
      "",
      ...spec.ticket.acceptanceCriteria.map((item) => `- ${text(item)}`),
      "",
      "## Evidência da revisão exata",
      "",
      `Run: ${run.id}. Tentativa: ${attempt.id}. Definição READY: ${spec.project.definitionVersion}.`,
      `Base: ${checkpoint.baseRevision}. HEAD do snapshot: ${checkpoint.codeRevision}. Alterações não commitadas são identificadas pelo manifesto ${snapshot.manifestHash}.`,
      `Resultado: ${attempt.resultDigest}. Bundle: ${attempt.artifactDigest}.`,
      "",
      "## Checks e baseline",
      "",
      ...result.checks.map(
        (check) =>
          `- ${text(check.name)} / ${check.phase} / rodada ${check.round}: ${check.status}, exit ${check.exitCode ?? "desconhecido"}; preexistente ${check.preExisting ? "sim" : "não"}.`,
      ),
      "",
      "## Revisão de IA",
      "",
      text(result.review.summary),
      ...result.review.findings.map((item) => `- ${text(item)}`),
      "",
      "## Chamadas observadas",
      "",
      ...result.runtimeObservations.map(
        (call) =>
          `- ${call.role}: ${call.provider}, instalação configurada ${call.installationId}, configuração ${call.configurationVersion}; modelo solicitado ${text(call.modelRequested ?? "desconhecido")}, efetivo ${text(call.modelEffective ?? "desconhecido")}; uso ${call.usage ? `${call.usage.inputTokens} entrada/${call.usage.outputTokens} saída` : "desconhecido"}.`,
      ),
      "",
      "## Artefatos e rollback",
      "",
      `Patch: ${snapshot.patchBytes} bytes, SHA ${snapshot.patchSha256}; arquivos novos: ${snapshot.untrackedFiles}; bytes totais: ${snapshot.totalArtifactBytes}.`,
      "Bundle JSON contém patch Git e arquivos novos base64. Não aplica alterações automaticamente. Rollback exige revisão humana da base/patch e preservação de evidências; nenhuma publicação, merge ou deploy faz parte do aceite.",
      "",
      "## Limitações e documentação",
      "",
      "Este relatório documenta evidências da entrega; não altera a documentação técnica no repositório do projeto. Checks e aprovação de IA não comprovam semanticamente todos os critérios. Confirme critérios, diff, arquivos e documentação antes do aceite. Modelos/uso desconhecidos não são estimados; instalação configurada não comprova identidade autenticada.",
      "",
    ].join("\n");
    const core = {
      schemaVersion: 1 as const,
      runId: run.id,
      attemptId: attempt.id,
      baseRevision: checkpoint.baseRevision,
      codeRevision: checkpoint.codeRevision,
      patchHash: snapshot.manifestHash,
      resultDigest: attempt.resultDigest,
      artifactDigest: attempt.artifactDigest,
      documentMarkdown,
      documentDigest: digest(documentMarkdown),
    };
    const delivery = runDeliverySchema.parse({
      ...core,
      deliveryDigest: digest(JSON.stringify(core)),
    });
    return runDeliveryStateSchema.parse({ delivery, accepted: false, reason: null });
  }
}

function summary(run: {
  id: string;
  ticketId: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  ticket: { projectId: string; title: string };
}) {
  return runSummarySchema.parse({
    id: run.id,
    ticketId: run.ticketId,
    projectId: run.ticket.projectId,
    title: run.ticket.title,
    status: run.status,
    version: run.version,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  });
}
