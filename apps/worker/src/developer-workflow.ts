import { randomUUID } from "node:crypto";
import type {
  DeveloperWorkflowRequest,
  DeveloperWorkflowResult,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeGuardState,
  SandboxCommandResult,
  WorkflowCheckObservation,
  WorkflowReview,
  WorkflowRuntimeObservation,
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
import type { ConfiguredAgentRouter } from "./configured-agent-router";

interface DeveloperWorkflowDependencies {
  workspaceManager: Pick<WorkspaceManager, "create">;
  contextBuilder: Pick<ContextBuilder, "build">;
  guard: Pick<RuntimeGuard, "initialState" | "authorizeAttempt" | "recordFailure">;
  agentRouter: Pick<ConfiguredAgentRouter, "resolve">;
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
  runtimeObservations: WorkflowRuntimeObservation[];
}

const MAX_PROMPT_CHARS = 200_000;

export class DeveloperWorkflow {
  private readonly createId: () => string;
  private readonly activeCancellations = new Set<() => Promise<boolean>>();
  private terminationUnknown = false;

  constructor(private readonly dependencies: DeveloperWorkflowDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
  }

  async execute(
    input: DeveloperWorkflowRequest,
    signal?: AbortSignal,
  ): Promise<DeveloperWorkflowResult> {
    if (this.terminationUnknown) throw new Error("Previous process termination is unknown");
    throwIfAborted(signal);
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
    throwIfAborted(signal);
    const progress: WorkflowProgress = {
      guardState: this.dependencies.guard.initialState(),
      developerExecutions: 0,
      reviewerExecutions: 0,
      checks: [],
      snapshots: [],
      review: null,
      runtimeObservations: [],
    };
    let activeRound = 0;
    try {
      const baseline = await this.runChecks(
        request,
        workspace,
        "BASELINE",
        0,
        new Set(),
        signal,
        (check) => progress.checks.push(check),
      );
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
        activeRound = round;
        throwIfAborted(signal);
        let developerRuntime: Awaited<ReturnType<ConfiguredAgentRouter["resolve"]>>;
        try {
          developerRuntime = await this.dependencies.agentRouter.resolve("DEVELOPER");
        } catch {
          return this.result(
            request,
            workspace,
            context.manifest,
            progress,
            "FAILED",
            "RUNTIME_ROUTE_UNAVAILABLE",
            "Configured Developer runtime route is unavailable",
            round,
          );
        }
        const developerAuthorization = this.dependencies.guard.authorizeAttempt(
          progress.guardState,
          developerRuntime.route.provider,
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
        if (progress.developerExecutions >= developerRuntime.maxAttempts) {
          return this.result(
            request,
            workspace,
            context.manifest,
            progress,
            "PAUSED_LIMIT",
            "RUNTIME_GUARD",
            "Configured Developer attempt limit was reached",
            round,
          );
        }

        const developer = await this.executeRuntime(
          developerRuntime.adapter,
          {
            schemaVersion: 1,
            executionId: this.createId(),
            workspacePath: workspace.workspacePath,
            prompt: boundedPrompt(
              developerPrompt(request, context.content, feedback, round),
              "Developer",
            ),
            permissionMode: developerRuntime.route.permissionMode,
            writablePaths: request.writablePaths,
            modelRequested: developerRuntime.route.model,
            limits: {
              ...request.runtimeLimits,
              timeoutMs: Math.min(request.runtimeLimits.timeoutMs, developerRuntime.timeoutMs),
            },
          },
          signal,
        );
        progress.developerExecutions += 1;
        progress.runtimeObservations.push(observeRuntime("DEVELOPER", developerRuntime, developer));
        throwIfAborted(signal);
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
          signal,
          (check) => progress.checks.push(check),
        );
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

        let reviewerRuntime: Awaited<ReturnType<ConfiguredAgentRouter["resolve"]>>;
        try {
          reviewerRuntime = await this.dependencies.agentRouter.resolve("REVIEWER");
        } catch {
          return this.result(
            request,
            workspace,
            context.manifest,
            progress,
            "FAILED",
            "RUNTIME_ROUTE_UNAVAILABLE",
            "Configured Reviewer runtime route is unavailable",
            round,
          );
        }
        if (reviewerRuntime.route.permissionMode !== "READ_ONLY") {
          return this.result(
            request,
            workspace,
            context.manifest,
            progress,
            "FAILED",
            "RUNTIME_ROUTE_UNAVAILABLE",
            "Reviewer runtime route must be READ_ONLY",
            round,
          );
        }
        if (progress.reviewerExecutions >= reviewerRuntime.maxAttempts) {
          return this.result(
            request,
            workspace,
            context.manifest,
            progress,
            "PAUSED_LIMIT",
            "RUNTIME_GUARD",
            "Configured Reviewer attempt limit was reached",
            round,
          );
        }
        const reviewerAuthorization = this.dependencies.guard.authorizeAttempt(
          progress.guardState,
          reviewerRuntime.route.provider,
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
        const reviewer = await this.executeRuntime(
          reviewerRuntime.adapter,
          {
            schemaVersion: 1,
            executionId: this.createId(),
            workspacePath: workspace.workspacePath,
            prompt: boundedPrompt(
              reviewerPrompt(request, context.content, postChecks, snapshot.manifest.manifestHash),
              "Reviewer",
            ),
            permissionMode: reviewerRuntime.route.permissionMode,
            writablePaths: [],
            modelRequested: reviewerRuntime.route.model,
            limits: {
              ...request.runtimeLimits,
              timeoutMs: Math.min(request.runtimeLimits.timeoutMs, reviewerRuntime.timeoutMs),
            },
          },
          signal,
        );
        progress.reviewerExecutions += 1;
        progress.runtimeObservations.push(observeRuntime("REVIEWER", reviewerRuntime, reviewer));
        throwIfAborted(signal);
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
    } catch (error) {
      if (
        !signal?.aborted ||
        !(await this.cancelActive()) ||
        progress.checks.some((check) => !check.stoppedConfirmed)
      )
        throw error;
      const snapshot = await this.dependencies.snapshots.capture({
        schemaVersion: 1,
        workspacePath: workspace.workspacePath,
        limits: request.snapshotLimits,
      });
      progress.snapshots = [...progress.snapshots, snapshot.manifest].slice(-3);
      return this.result(
        request,
        workspace,
        context.manifest,
        progress,
        "CANCELLED",
        "INTERRUPTED",
        "Execution interrupted after confirmed stop; snapshot and partial observations preserved",
        activeRound,
      );
    }
  }

  private async runChecks(
    request: DeveloperWorkflowRequest,
    workspace: WorkspaceCreateResult,
    phase: WorkflowCheckObservation["phase"],
    round: number,
    baselineFailures: ReadonlySet<string>,
    signal?: AbortSignal,
    onObservation?: (check: WorkflowCheckObservation) => void,
  ): Promise<WorkflowCheckObservation[]> {
    const observations: WorkflowCheckObservation[] = [];
    for (const check of request.checks) {
      throwIfAborted(signal);
      const result: SandboxCommandResult = await this.executeSandbox(
        {
          schemaVersion: 1,
          executionId: this.createId(),
          workspacePath: workspace.workspacePath,
          command: check.command,
          args: check.args,
          environment: check.environment,
          writablePaths: [],
          limits: request.sandboxLimits,
        },
        signal,
      );
      const observation: WorkflowCheckObservation = {
        name: check.name,
        phase,
        round,
        status: result.status,
        exitCode: result.exitCode,
        stoppedConfirmed: result.stoppedConfirmed,
        preExisting: phase === "POST_CHANGE" && baselineFailures.has(check.name),
      };
      observations.push(observation);
      onObservation?.(observation);
      throwIfAborted(signal);
    }
    return observations;
  }

  async cancelActive(): Promise<boolean> {
    const results = await Promise.all(
      [...this.activeCancellations].map((cancel) => cancel().catch(() => false)),
    );
    return !this.terminationUnknown && results.every(Boolean);
  }

  private async executeRuntime(
    adapter: RuntimeAdapter,
    request: RuntimeExecutionRequest,
    signal?: AbortSignal,
  ): Promise<RuntimeExecutionResult> {
    throwIfAborted(signal);
    let settled = false;
    let cancellation: Promise<boolean> | undefined;
    const execution = Promise.resolve().then(() => adapter.execute(request));
    const cancel = (): Promise<boolean> => {
      cancellation ??= (async () => {
        while (!settled) {
          const result = await adapter.cancel(request.executionId).catch(() => null);
          if (result?.status === "CANCELLED") {
            await execution.catch(() => undefined);
            return true;
          }
          if (!settled) await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return true;
      })();
      return cancellation;
    };
    const onAbort = () => void cancel();
    this.activeCancellations.add(cancel);
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const result = await execution;
      settled = true;
      return result;
    } catch (error) {
      this.terminationUnknown = true;
      throw error;
    } finally {
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      this.activeCancellations.delete(cancel);
    }
  }

  private async executeSandbox(
    input: Parameters<SandboxRunner["execute"]>[0],
    signal?: AbortSignal,
  ): Promise<SandboxCommandResult> {
    throwIfAborted(signal);
    const execution = Promise.resolve().then(() =>
      this.dependencies.sandbox.execute(input, signal),
    );
    const cancel = async (): Promise<boolean> => {
      try {
        return (await execution).stoppedConfirmed;
      } catch {
        return false;
      }
    };
    this.activeCancellations.add(cancel);
    try {
      const result = await execution;
      if (!result.stoppedConfirmed) this.terminationUnknown = true;
      return result;
    } catch (error) {
      this.terminationUnknown = true;
      throw error;
    } finally {
      this.activeCancellations.delete(cancel);
    }
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
      runtimeObservations: progress.runtimeObservations,
    });
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Developer workflow was cancelled");
}

function observeRuntime(
  role: "DEVELOPER" | "REVIEWER",
  runtime: Awaited<ReturnType<ConfiguredAgentRouter["resolve"]>>,
  result: RuntimeExecutionResult,
): WorkflowRuntimeObservation {
  return {
    executionId: result.executionId,
    role,
    installationId: runtime.route.installationId,
    provider: runtime.route.provider,
    modelRequested: result.modelRequested,
    modelEffective: result.modelEffective,
    configurationVersion: runtime.configurationVersion,
    configurationObservedAt: runtime.configurationObservedAt,
    status: result.status,
    errorCode: result.error?.code ?? null,
    usage: result.usage,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
  };
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
