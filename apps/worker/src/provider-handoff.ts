import { randomUUID } from "node:crypto";
import type {
  ProviderHandoffRequest,
  ProviderHandoffResult,
  RuntimeProvider,
} from "@le-fabrique/contracts";
import { providerHandoffRequestSchema, providerHandoffResultSchema } from "@le-fabrique/contracts";
import type {
  RuntimeAdapter,
  RuntimeGuard,
  SnapshotManager,
  WorkspaceManager,
} from "@le-fabrique/runtime";
import { resolveAgentRoute } from "./agent-route";

interface ProviderHandoffDependencies {
  workspaceManager: Pick<WorkspaceManager, "create">;
  snapshots: Pick<SnapshotManager, "restore">;
  guard: Pick<RuntimeGuard, "authorizeAttempt">;
  adapters: Partial<Record<RuntimeProvider, Pick<RuntimeAdapter, "execute">>>;
  createId?: () => string;
}

export class ProviderHandoff {
  private readonly createId: () => string;

  constructor(private readonly dependencies: ProviderHandoffDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
  }

  async execute(input: ProviderHandoffRequest): Promise<ProviderHandoffResult> {
    const request = providerHandoffRequestSchema.parse(input);
    let route: ProviderHandoffResult["route"] = null;
    try {
      route = resolveAgentRoute(request.configuration, request.targetRole);
    } catch (error) {
      return this.result(request, {
        status: "WAITING_PROVIDER",
        route: null,
        workspace: null,
        restore: null,
        execution: null,
        guardState: request.guardState,
        diagnostic: controlledMessage(error, "Target provider is not eligible"),
      });
    }
    if (route.provider === request.source.provider) {
      return this.result(request, {
        status: "FAILED",
        route,
        workspace: null,
        restore: null,
        execution: null,
        guardState: request.guardState,
        diagnostic: "Handoff target must use another provider",
      });
    }
    const authorization = this.dependencies.guard.authorizeAttempt(
      request.guardState,
      route.provider,
    );
    if (authorization.action === "PAUSE") {
      return this.result(request, {
        status: "PAUSED_LIMIT",
        route,
        workspace: null,
        restore: null,
        execution: null,
        guardState: authorization.state,
        diagnostic: `Handoff blocked by ${authorization.reason ?? "runtime guard"}`,
      });
    }
    const adapter = this.dependencies.adapters[route.provider];
    if (!adapter) {
      return this.result(request, {
        status: "WAITING_PROVIDER",
        route,
        workspace: null,
        restore: null,
        execution: null,
        guardState: authorization.state,
        diagnostic: "Target runtime adapter is unavailable",
      });
    }
    try {
      const workspace = await this.dependencies.workspaceManager.create({
        executionId: request.handoffId,
        repositoryPath: request.repositoryPath,
        revision: request.baseRevision,
      });
      const restore = await this.dependencies.snapshots.restore(
        request.snapshot,
        workspace.workspacePath,
      );
      const execution = await adapter.execute({
        schemaVersion: 1,
        executionId: this.createId(),
        workspacePath: workspace.workspacePath,
        prompt: handoffPrompt(request),
        permissionMode: route.permissionMode,
        writablePaths: [],
        modelRequested: route.model,
        limits: request.runtimeLimits,
      });
      const waiting = ["AUTH_REQUIRED", "RATE_LIMITED"].includes(execution.error?.code ?? "");
      return this.result(request, {
        status:
          execution.status === "COMPLETED" ? "COMPLETED" : waiting ? "WAITING_PROVIDER" : "FAILED",
        route,
        workspace,
        restore,
        execution,
        guardState: authorization.state,
        diagnostic:
          execution.status === "COMPLETED"
            ? "Snapshot restored and target provider completed"
            : (execution.error?.message ?? "Target provider failed"),
      });
    } catch {
      return this.result(request, {
        status: "FAILED",
        route,
        workspace: null,
        restore: null,
        execution: null,
        guardState: authorization.state,
        diagnostic: "Handoff workspace or snapshot validation failed",
      });
    }
  }

  private result(
    request: ProviderHandoffRequest,
    value: Omit<ProviderHandoffResult, "schemaVersion" | "handoffId">,
  ): ProviderHandoffResult {
    return providerHandoffResultSchema.parse({
      schemaVersion: 1,
      handoffId: request.handoffId,
      ...value,
    });
  }
}

function handoffPrompt(request: ProviderHandoffRequest): string {
  return [
    `Role: ${request.targetRole}.`,
    "Continue from the restored, verified workspace snapshot.",
    `Objective: ${request.objective}`,
    `Acceptance criteria:\n- ${request.acceptanceCriteria.join("\n- ")}`,
    `Source provider: ${request.source.provider}`,
    `Snapshot manifest SHA-256: ${request.snapshot.manifest.manifestHash}`,
    "No provider session, credential, hidden reasoning or raw provider output was transferred.",
  ].join("\n\n");
}

function controlledMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  return error.message.slice(0, 1000) || fallback;
}
