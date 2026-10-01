import { randomUUID } from "node:crypto";
import type {
  DeveloperWorkflowRequest,
  DeveloperWorkflowResult,
  RuntimeExecutionResult,
  RuntimeGuardState,
  SandboxCommandResult,
  WorkflowCheckObservation,
  WorkflowReview,
  WorkspaceCreateResult,
} from "@le-fabrique/contracts";
import {
  developerWorkflowRequestSchema,
  developerWorkflowResultSchema,
  workflowReviewSchema,
} from "@le-fabrique/contracts";
import type {
  ContextBuilder,
  RuntimeAdapter,
  RuntimeGuard,
  SandboxRunner,
  SnapshotManager,
  WorkspaceManager,
} from "@le-fabrique/runtime";

interface DeveloperWorkflowDependencies {
  workspaceManager: Pick<WorkspaceManager, "create">;
  contextBuilder: Pick<ContextBuilder, "build">;
  guard: Pick<RuntimeGuard, "initialState" | "authorizeAttempt" | "recordFailure">;
  adapter: Pick<RuntimeAdapter, "execute">;
  sandbox: Pick<SandboxRunner, "execute">;
  snapshots: Pick<SnapshotManager, "capture">;
  createId?: () => string;
}

interface WorkflowProgress {
  guardState: RuntimeGuardState;
  developerExecutions: number;
  reviewerExecutions: number;
  checks: WorkflowCheckObservation[];
  snapshots: DeveloperWorkflowResult["snapshots"];
  review: WorkflowReview | null;
}

const MAX_PROMPT_CHARS = 200_000;

export class DeveloperWorkflow {
  private readonly createId: () => string;

  constructor(private readonly dependencies: DeveloperWorkflowDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
  }

  async execute(input: DeveloperWorkflowRequest): Promise<DeveloperWorkflowResult> {
    const request = developerWorkflowRequestSchema.parse(input);
    const workspace = await this.dependencies.workspaceManager.create({
      executionId: request.workflowId,
      repositoryPath: request.repositoryPath,
      revision: request.baseRevision,
    });
    const context = await this.dependencies.contextBuilder.build({
      schemaVersion: 1,
      workspacePath: workspace.workspacePath,
      baseRevision: workspace.revision,
      sources: request.contextSources,
      limits: request.contextLimits,
    });
    const progress: WorkflowProgress = {
      guardState: this.dependencies.guard.initialState(),
      developerExecutions: 0,
      reviewerExecutions: 0,
      checks: [],
      snapshots: [],
      review: null,
    };
    const baseline = await this.runChecks(request, workspace, "BASELINE", 0, new Set());
    progress.checks.push(...baseline);
    if (baseline.some((check) => !check.stoppedConfirmed)) {
      return this.result(
        request,
        workspace,
        context.manifest,
        progress,
        "FAILED",
        "CHECK_UNQUIESCED",
        "Baseline check termination was not confirmed",
        0,
      );
    }
    const baselineFailures = new Set(
      baseline.filter((check) => !checkPassed(check)).map((check) => check.name),
    );
    let feedback = "No previous review feedback.";

    for (let round = 0; round <= request.maxCorrectionRounds; round += 1) {
      const developerAuthorization = this.dependencies.guard.authorizeAttempt(
        progress.guardState,
        "codex",
      );
      progress.guardState = developerAuthorization.state;
      if (developerAuthorization.action === "PAUSE") {
        return this.result(
          request,
          workspace,
          context.manifest,
          progress,
          "PAUSED_LIMIT",
          "RUNTIME_GUARD",
          `Developer blocked by ${developerAuthorization.reason ?? "runtime guard"}`,
          round,
        );
      }

      const developer = await this.dependencies.adapter.execute({
        schemaVersion: 1,
        executionId: this.createId(),
        workspacePath: workspace.workspacePath,
        prompt: boundedPrompt(
          developerPrompt(request, context.content, feedback, round),
          "Developer",
        ),
        permissionMode: "WORKSPACE_WRITE",
        modelRequested: request.modelRequested,
        limits: request.runtimeLimits,
      });
      progress.developerExecutions += 1;
      if (developer.status !== "COMPLETED") {
        const failure = this.dependencies.guard.recordFailure(
          progress.guardState,
          runtimeFailureFingerprint("developer", developer),
        );
        progress.guardState = failure.state;
        if (failure.action === "PAUSE" || round === request.maxCorrectionRounds) {
          return this.result(
            request,
            workspace,
            context.manifest,
            progress,
            "PAUSED_LIMIT",
            "DEVELOPER_FAILED",
            developer.error?.message ?? "Developer execution failed",
            round,
          );
        }
        feedback = `Developer failed safely: ${developer.error?.code ?? developer.status}.`;
        continue;
      }

      const postChecks = await this.runChecks(
        request,
        workspace,
        "POST_CHANGE",
        round,
        baselineFailures,
      );
      progress.checks.push(...postChecks);
      if (postChecks.some((check) => !check.stoppedConfirmed)) {
        return this.result(
          request,
          workspace,
          context.manifest,
          progress,
          "FAILED",
          "CHECK_UNQUIESCED",
          "Post-change check termination was not confirmed",
          round,
        );
      }
      const snapshot = await this.dependencies.snapshots.capture({
        schemaVersion: 1,
        workspacePath: workspace.workspacePath,
        limits: request.snapshotLimits,
      });
      progress.snapshots.push(snapshot.manifest);
      const regressions = postChecks.filter((check) => !checkPassed(check) && !check.preExisting);
      if (regressions.length > 0) {
        const fingerprint = `checks:${regressions
          .map((check) => check.name)
          .sort()
          .join(",")}`;
        const failure = this.dependencies.guard.recordFailure(progress.guardState, fingerprint);
        progress.guardState = failure.state;
        if (failure.action === "PAUSE" || round === request.maxCorrectionRounds) {
          return this.result(
            request,
            workspace,
            context.manifest,
            progress,
            "PAUSED_LIMIT",
            "CHECK_REGRESSION",
            `New check failures: ${regressions.map((check) => check.name).join(", ")}`,
            round,
          );
        }
        feedback = `Fix only these new check failures: ${regressions
          .map((check) => check.name)
          .join(", ")}.`;
        continue;
      }

      const reviewerAuthorization = this.dependencies.guard.authorizeAttempt(
        progress.guardState,
        "codex",
      );
      progress.guardState = reviewerAuthorization.state;
      if (reviewerAuthorization.action === "PAUSE") {
        return this.result(
          request,
          workspace,
          context.manifest,
          progress,
          "PAUSED_LIMIT",
          "RUNTIME_GUARD",
          `Reviewer blocked by ${reviewerAuthorization.reason ?? "runtime guard"}`,
          round,
        );
      }
      const reviewer = await this.dependencies.adapter.execute({
        schemaVersion: 1,
        executionId: this.createId(),
        workspacePath: workspace.workspacePath,
        prompt: boundedPrompt(
          reviewerPrompt(request, context.content, postChecks, snapshot.manifest.manifestHash),
          "Reviewer",
        ),
        permissionMode: "READ_ONLY",
        modelRequested: request.modelRequested,
        limits: request.runtimeLimits,
      });
      progress.reviewerExecutions += 1;
      const review = parseReview(reviewer);
      if (!review) {
        return this.result(
          request,
          workspace,
          context.manifest,
          progress,
          "FAILED",
          "REVIEW_INVALID",
          reviewer.status === "COMPLETED"
            ? "Reviewer returned an invalid structured verdict"
            : (reviewer.error?.message ?? "Reviewer execution failed"),
          round,
        );
      }
      progress.review = review;
      if (review.verdict === "APPROVE") {
        return this.result(
          request,
          workspace,
          context.manifest,
          progress,
          "AWAITING_HUMAN",
          "APPROVED",
          "Developer, checks and independent review completed",
          round,
        );
      }
      if (round === request.maxCorrectionRounds) {
        return this.result(
          request,
          workspace,
          context.manifest,
          progress,
          "PAUSED_LIMIT",
          "REVIEW_REJECTED",
          review.summary,
          round,
        );
      }
      const reviewFailure = this.dependencies.guard.recordFailure(
        progress.guardState,
        `review:${[review.summary, ...review.findings].join("|")}`.slice(0, 200),
      );
      progress.guardState = reviewFailure.state;
      if (reviewFailure.action === "PAUSE") {
        return this.result(
          request,
          workspace,
          context.manifest,
          progress,
          "PAUSED_LIMIT",
          "REVIEW_REJECTED",
          review.summary,
          round,
        );
      }
      feedback = [review.summary, ...review.findings].join("\n");
    }

    throw new Error("Workflow exhausted without a terminal result");
  }

  private async runChecks(
    request: DeveloperWorkflowRequest,
    workspace: WorkspaceCreateResult,
    phase: WorkflowCheckObservation["phase"],
    round: number,
    baselineFailures: ReadonlySet<string>,
  ): Promise<WorkflowCheckObservation[]> {
    const observations: WorkflowCheckObservation[] = [];
    for (const check of request.checks) {
      const result: SandboxCommandResult = await this.dependencies.sandbox.execute({
        schemaVersion: 1,
        executionId: this.createId(),
        workspacePath: workspace.workspacePath,
        command: check.command,
        args: check.args,
        environment: check.environment,
        limits: request.sandboxLimits,
      });
      observations.push({
        name: check.name,
        phase,
        round,
        status: result.status,
        exitCode: result.exitCode,
        stoppedConfirmed: result.stoppedConfirmed,
        preExisting: phase === "POST_CHANGE" && baselineFailures.has(check.name),
      });
    }
    return observations;
  }

  private result(
    request: DeveloperWorkflowRequest,
    workspace: WorkspaceCreateResult,
    contextManifest: DeveloperWorkflowResult["contextManifest"],
    progress: WorkflowProgress,
    status: DeveloperWorkflowResult["status"],
    reason: DeveloperWorkflowResult["reason"],
    diagnostic: string,
    round: number,
  ): DeveloperWorkflowResult {
    return developerWorkflowResultSchema.parse({
      schemaVersion: 1,
      workflowId: request.workflowId,
      status,
      reason,
      workspace,
      contextManifest,
      guardState: progress.guardState,
      developerExecutions: progress.developerExecutions,
      reviewerExecutions: progress.reviewerExecutions,
      corrections: Math.min(round, request.maxCorrectionRounds),
      checks: progress.checks,
      snapshots: progress.snapshots,
      review: progress.review,
      diagnostic: diagnostic.slice(0, 1000),
    });
  }
}

function checkPassed(check: WorkflowCheckObservation): boolean {
  return check.status === "COMPLETED" && check.exitCode === 0 && check.stoppedConfirmed;
}

function runtimeFailureFingerprint(role: string, result: RuntimeExecutionResult): string {
  return `${role}:${result.error?.code ?? result.status}`.slice(0, 200);
}

function parseReview(result: RuntimeExecutionResult): WorkflowReview | null {
  if (result.status !== "COMPLETED" || !result.finalMessage) return null;
  try {
    return workflowReviewSchema.parse(JSON.parse(result.finalMessage));
  } catch {
    return null;
  }
}

function boundedPrompt(prompt: string, role: string): string {
  if (prompt.length > MAX_PROMPT_CHARS) throw new Error(`${role} prompt exceeds runtime limit`);
  return prompt;
}

function developerPrompt(
  request: DeveloperWorkflowRequest,
  context: string,
  feedback: string,
  round: number,
): string {
  return [
    "Role: Developer. Work only in the supplied workspace.",
    `Objective: ${request.objective}`,
    `Acceptance criteria:\n- ${request.acceptanceCriteria.join("\n- ")}`,
    `Correction round: ${round}`,
    `Prior feedback: ${feedback}`,
    "Context:",
    context,
  ].join("\n\n");
}

function reviewerPrompt(
  request: DeveloperWorkflowRequest,
  context: string,
  checks: WorkflowCheckObservation[],
  snapshotHash: string,
): string {
  return [
    "Role: independent Reviewer. Do not modify files.",
    `Objective: ${request.objective}`,
    `Acceptance criteria:\n- ${request.acceptanceCriteria.join("\n- ")}`,
    `Post-change checks: ${JSON.stringify(checks)}`,
    `Snapshot manifest SHA-256: ${snapshotHash}`,
    'Return only JSON matching: {"schemaVersion":1,"verdict":"APPROVE|REQUEST_CHANGES","summary":"...","findings":["..."]}',
    "Context:",
    context,
  ].join("\n\n");
}
