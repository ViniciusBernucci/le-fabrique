import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type {
  ProviderStatus,
  ProviderUsageObservation,
  RuntimeCancelResult,
  RuntimeError,
  RuntimeEvent,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeUsage,
} from "@le-fabrique/contracts";
import {
  providerStatusSchema,
  providerUsageObservationSchema,
  runtimeCancelResultSchema,
  runtimeEventSchema,
  runtimeExecutionRequestSchema,
  runtimeExecutionResultSchema,
  runtimeUsageSchema,
} from "@le-fabrique/contracts";
import { classifyClaudeSubscriptionStatus } from "./claude-auth";
import type { RuntimeAdapter, RuntimeEventSink } from "./runtime-adapter";
import { sanitizeSubscriptionEnvironment } from "./runtime-guard";

type TerminationReason = "cancel" | "timeout" | "log-limit" | "result-unknown";

interface ActiveExecution {
  child: ChildProcessWithoutNullStreams;
  reason: TerminationReason | null;
  cancelWaiters: Array<(result: RuntimeCancelResult) => void>;
  forceKillTimer: NodeJS.Timeout | null;
}

interface ProbeResult {
  exitCode: number | null;
  output: string;
}

export interface ClaudeAdapterOptions {
  binaryPath?: string;
  binaryArgsPrefix?: readonly string[];
  environment?: NodeJS.ProcessEnv;
  forceKillAfterMs?: number;
  probeTimeoutMs?: number;
  now?: () => Date;
}

const capabilities = [
  "print",
  "stream-json",
  "read-only",
  "workspace-write",
  "cancel",
  "subscription-auth",
] as const;

export class ClaudeAdapter implements RuntimeAdapter {
  readonly name = "claude" as const;

  private readonly binaryPath: string;
  private readonly binaryArgsPrefix: readonly string[];
  private readonly environment: NodeJS.ProcessEnv;
  private readonly forceKillAfterMs: number;
  private readonly probeTimeoutMs: number;
  private readonly now: () => Date;
  private readonly active = new Map<string, ActiveExecution>();

  constructor(options: ClaudeAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? "/usr/bin/claude";
    this.binaryArgsPrefix = options.binaryArgsPrefix ?? [];
    this.environment = options.environment ?? process.env;
    this.forceKillAfterMs = options.forceKillAfterMs ?? 2_000;
    this.probeTimeoutMs = options.probeTimeoutMs ?? 5_000;
    this.now = options.now ?? (() => new Date());
  }

  async execute(
    input: RuntimeExecutionRequest,
    eventSink?: RuntimeEventSink,
  ): Promise<RuntimeExecutionResult> {
    const request = runtimeExecutionRequestSchema.parse(input);
    const startedAt = this.timestamp();
    if (this.active.size > 0) {
      return this.failureResult(request, startedAt, null, {
        code: "PROVIDER_BUSY",
        message: "The Claude adapter already has an active execution",
        retryable: true,
      });
    }
    const workspace = await this.resolveWorkspace(request.workspacePath).catch(() => null);
    if (!workspace) {
      return this.failureResult(request, startedAt, null, {
        code: "TOOL_DENIED",
        message: "The requested workspace is unavailable",
        retryable: false,
      });
    }

    const child = spawn(this.binaryPath, this.executionArguments(request), {
      cwd: workspace,
      env: this.subscriptionEnvironment(),
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const active: ActiveExecution = {
      child,
      reason: null,
      cancelWaiters: [],
      forceKillTimer: null,
    };
    this.active.set(request.executionId, active);
    this.emit(eventSink, {
      type: "started",
      executionId: request.executionId,
      timestamp: startedAt,
    });

    return await new Promise<RuntimeExecutionResult>((resolve) => {
      let stdoutBuffer = "";
      let stderr = "";
      let observedBytes = 0;
      let providerSessionId: string | null = null;
      let modelEffective: string | null = null;
      let finalMessage: string | null = null;
      let usage: RuntimeUsage | null = null;
      let resultObserved = false;
      let reportedFailure = "";
      let spawnError: NodeJS.ErrnoException | null = null;
      let settled = false;

      const terminate = (reason: TerminationReason): void => {
        if (!active.reason) active.reason = reason;
        this.signal(active, "SIGTERM");
      };
      const accountBytes = (length: number): boolean => {
        observedBytes += length;
        if (observedBytes <= request.limits.maxLogBytes) return true;
        terminate("log-limit");
        return false;
      };
      const processLine = (line: string): void => {
        if (!line.trim()) return;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line) as Record<string, unknown>;
        } catch {
          terminate("result-unknown");
          return;
        }
        if (typeof event.session_id === "string") providerSessionId = event.session_id;
        if (typeof event.model === "string") modelEffective = event.model;
        if (event.type === "assistant" && this.isRecord(event.message)) {
          this.processAssistantContent(event.message.content, request.executionId, eventSink);
          return;
        }
        if (event.type !== "result") return;
        resultObserved = event.is_error !== true && event.subtype === "success";
        if (typeof event.result === "string") {
          if (resultObserved) finalMessage = event.result.slice(0, 200_000);
          else reportedFailure = event.result.slice(0, 500);
        }
        usage = this.parseUsage(event.usage);
        if (usage) {
          this.emit(eventSink, {
            type: "usage_observed",
            executionId: request.executionId,
            timestamp: this.timestamp(),
            usage,
          });
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        if (!accountBytes(chunk.byteLength)) return;
        stdoutBuffer += chunk.toString("utf8");
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (!accountBytes(chunk.byteLength)) return;
        const remaining = Math.max(0, request.limits.maxLogBytes - Buffer.byteLength(stderr));
        if (remaining > 0) stderr += chunk.subarray(0, remaining).toString("utf8");
      });
      child.once("error", (error: NodeJS.ErrnoException) => {
        spawnError = error;
      });
      child.stdin.on("error", () => {
        // The close handler owns result normalization.
      });
      const timeout = setTimeout(() => terminate("timeout"), request.limits.timeoutMs);
      timeout.unref();
      child.once("close", (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (active.forceKillTimer) clearTimeout(active.forceKillTimer);
        if (stdoutBuffer.trim()) processLine(stdoutBuffer);
        const finishedAt = this.timestamp();
        const result = this.finalizeResult({
          request,
          startedAt,
          finishedAt,
          exitCode,
          active,
          spawnError,
          resultObserved,
          reportedFailure,
          stderr,
          providerSessionId,
          modelEffective,
          finalMessage,
          usage,
        });
        this.active.delete(request.executionId);
        this.emit(eventSink, {
          type: "process_exited",
          executionId: request.executionId,
          timestamp: finishedAt,
          exitCode,
        });
        this.emit(eventSink, {
          type: "finished",
          executionId: request.executionId,
          timestamp: finishedAt,
          status: result.status,
        });
        for (const waiter of active.cancelWaiters) {
          waiter(
            runtimeCancelResultSchema.parse({
              executionId: request.executionId,
              status: result.status === "CANCELLED" ? "CANCELLED" : "NOT_FOUND",
            }),
          );
        }
        resolve(result);
      });
      child.stdin.end(request.prompt);
    });
  }

  async cancel(executionId: string): Promise<RuntimeCancelResult> {
    const active = this.active.get(executionId);
    if (!active) return runtimeCancelResultSchema.parse({ executionId, status: "NOT_FOUND" });
    active.reason = "cancel";
    const result = new Promise<RuntimeCancelResult>((resolve) =>
      active.cancelWaiters.push(resolve),
    );
    this.signal(active, "SIGTERM");
    return await result;
  }

  async getStatus(): Promise<ProviderStatus> {
    const observedAt = this.timestamp();
    const [version, auth] = await Promise.all([
      this.runProbe(["--version"]),
      this.runProbe(["auth", "status", "--json"]),
    ]);
    let state: ProviderStatus["state"] = "ERROR";
    if (auth.exitCode === 0) {
      try {
        state = classifyClaudeSubscriptionStatus(JSON.parse(auth.output));
      } catch {
        state = "ERROR";
      }
    }
    return providerStatusSchema.parse({
      provider: "claude",
      state,
      authMode: "claude-subscription",
      observedAt,
      cliVersion: version.exitCode === 0 ? version.output.trim().slice(0, 120) : null,
    });
  }

  async getCapabilities(): Promise<readonly string[]> {
    return capabilities;
  }

  async getUsage(): Promise<ProviderUsageObservation> {
    return providerUsageObservationSchema.parse({
      provider: "claude",
      state: "UNKNOWN",
      value: null,
      unit: null,
      resetAt: null,
      observedAt: this.timestamp(),
      source: "client-not-exposed",
    });
  }

  private async resolveWorkspace(path: string): Promise<string> {
    if (!isAbsolute(path)) throw new Error("workspace must be absolute");
    const resolved = await realpath(path);
    const metadata = await stat(resolved);
    if (!metadata.isDirectory()) throw new Error("workspace must be a directory");
    return resolved;
  }

  private executionArguments(request: RuntimeExecutionRequest): string[] {
    const write = request.permissionMode === "WORKSPACE_WRITE";
    const args = [
      ...this.binaryArgsPrefix,
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--safe-mode",
      "--restricted",
      "--strict-mcp-config",
      "--no-chrome",
      "--permission-prompts",
      "none",
      "--permission-mode",
      write ? "acceptEdits" : "plan",
      "--tools",
      write ? "Read,Edit,Write,Glob,Grep" : "Read,Glob,Grep",
    ];
    if (request.modelRequested) args.push("--model", request.modelRequested);
    return args;
  }

  private subscriptionEnvironment(): NodeJS.ProcessEnv {
    return sanitizeSubscriptionEnvironment(this.environment).environment;
  }

  private signal(active: ActiveExecution, signal: NodeJS.Signals): void {
    if (active.child.exitCode !== null) return;
    try {
      if (process.platform !== "win32" && active.child.pid) process.kill(-active.child.pid, signal);
      else active.child.kill(signal);
    } catch {
      active.child.kill(signal);
    }
    if (signal === "SIGTERM" && !active.forceKillTimer) {
      active.forceKillTimer = setTimeout(
        () => this.signal(active, "SIGKILL"),
        this.forceKillAfterMs,
      );
      active.forceKillTimer.unref();
    }
  }

  private async runProbe(args: readonly string[]): Promise<ProbeResult> {
    return await new Promise<ProbeResult>((resolve) => {
      const child = spawn(this.binaryPath, [...this.binaryArgsPrefix, ...args], {
        env: this.subscriptionEnvironment(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      const append = (chunk: Buffer): void => {
        if (Buffer.byteLength(output) < 8_192) output += chunk.toString("utf8");
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      const timer = setTimeout(() => child.kill("SIGKILL"), this.probeTimeoutMs);
      timer.unref();
      let resolved = false;
      const finish = (result: ProbeResult): void => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      };
      child.once("error", () => finish({ exitCode: null, output }));
      child.once("close", (exitCode) => finish({ exitCode, output: output.slice(0, 8_192) }));
    });
  }

  private finalizeResult(input: {
    request: RuntimeExecutionRequest;
    startedAt: string;
    finishedAt: string;
    exitCode: number | null;
    active: ActiveExecution;
    spawnError: NodeJS.ErrnoException | null;
    resultObserved: boolean;
    reportedFailure: string;
    stderr: string;
    providerSessionId: string | null;
    modelEffective: string | null;
    finalMessage: string | null;
    usage: RuntimeUsage | null;
  }): RuntimeExecutionResult {
    const common = {
      schemaVersion: 1 as const,
      executionId: input.request.executionId,
      provider: "claude" as const,
      exitCode: input.exitCode,
      providerSessionId: input.providerSessionId,
      modelRequested: input.request.modelRequested,
      modelEffective: input.modelEffective,
      finalMessage: input.finalMessage,
      usage: input.usage,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    };
    if (input.active.reason === "cancel") {
      return runtimeExecutionResultSchema.parse({
        ...common,
        providerSessionId: null,
        status: "CANCELLED",
        error: { code: "CANCELLED", message: "Execution cancelled", retryable: false },
      });
    }
    if (input.active.reason === "timeout") {
      return runtimeExecutionResultSchema.parse({
        ...common,
        providerSessionId: null,
        status: "TIMED_OUT",
        error: { code: "TIMEOUT", message: "Execution timed out", retryable: true },
      });
    }
    if (input.active.reason === "log-limit") {
      return runtimeExecutionResultSchema.parse({
        ...common,
        providerSessionId: null,
        status: "FAILED",
        error: { code: "LOG_LIMIT", message: "Execution log limit exceeded", retryable: false },
      });
    }
    if (input.active.reason === "result-unknown") {
      return runtimeExecutionResultSchema.parse({
        ...common,
        providerSessionId: null,
        status: "FAILED",
        error: { code: "RESULT_UNKNOWN", message: "Invalid JSONL from Claude", retryable: false },
      });
    }
    if (input.spawnError) {
      return runtimeExecutionResultSchema.parse({
        ...common,
        providerSessionId: null,
        status: "FAILED",
        error: {
          code: input.spawnError.code === "ENOENT" ? "UNSUPPORTED" : "TRANSIENT",
          message:
            input.spawnError.code === "ENOENT"
              ? "Claude executable not found"
              : "Claude failed to start",
          retryable: input.spawnError.code !== "ENOENT",
        },
      });
    }
    if (input.exitCode === 0 && input.resultObserved) {
      return runtimeExecutionResultSchema.parse({ ...common, status: "COMPLETED", error: null });
    }
    return runtimeExecutionResultSchema.parse({
      ...common,
      providerSessionId: null,
      status: "FAILED",
      error: this.classifyFailure(`${input.reportedFailure}\n${input.stderr}`),
    });
  }

  private failureResult(
    request: RuntimeExecutionRequest,
    startedAt: string,
    exitCode: number | null,
    error: RuntimeError,
  ): RuntimeExecutionResult {
    return runtimeExecutionResultSchema.parse({
      schemaVersion: 1,
      executionId: request.executionId,
      provider: "claude",
      status: "FAILED",
      exitCode,
      providerSessionId: null,
      modelRequested: request.modelRequested,
      modelEffective: null,
      finalMessage: null,
      usage: null,
      error,
      startedAt,
      finishedAt: this.timestamp(),
    });
  }

  private classifyFailure(raw: string): RuntimeError {
    const message = raw.toLowerCase();
    if (/unauthorized|not logged|login required|authentication/.test(message)) {
      return {
        code: "AUTH_REQUIRED",
        message: "Claude subscription authentication is required",
        retryable: false,
      };
    }
    if (/rate.?limit|usage limit|quota/.test(message)) {
      return { code: "RATE_LIMITED", message: "Claude usage limit reached", retryable: true };
    }
    if (/context.*(large|length)|too many tokens/.test(message)) {
      return {
        code: "CONTEXT_TOO_LARGE",
        message: "Claude context is too large",
        retryable: false,
      };
    }
    if (/permission denied|restricted|not allowed/.test(message)) {
      return { code: "TOOL_DENIED", message: "Claude tool access was denied", retryable: false };
    }
    return { code: "TRANSIENT", message: "Claude execution failed", retryable: true };
  }

  private parseUsage(value: unknown): RuntimeUsage | null {
    if (!this.isRecord(value)) return null;
    const parsed = runtimeUsageSchema.safeParse({
      inputTokens: value.input_tokens,
      cachedInputTokens: value.cache_read_input_tokens ?? 0,
      outputTokens: value.output_tokens,
      reasoningOutputTokens: 0,
    });
    return parsed.success ? parsed.data : null;
  }

  private processAssistantContent(
    value: unknown,
    executionId: string,
    eventSink?: RuntimeEventSink,
  ): void {
    if (!Array.isArray(value)) return;
    for (const block of value) {
      if (!this.isRecord(block)) continue;
      if (block.type === "text") this.progress(eventSink, executionId, "agent_message");
      if (block.type !== "tool_use" || typeof block.name !== "string") continue;
      if (["Edit", "Write", "NotebookEdit"].includes(block.name)) {
        this.progress(eventSink, executionId, "file_change");
      } else if (["Bash", "PowerShell", "REPL"].includes(block.name)) {
        this.progress(eventSink, executionId, "command");
      } else {
        this.progress(eventSink, executionId, "tool");
      }
    }
  }

  private progress(
    eventSink: RuntimeEventSink | undefined,
    executionId: string,
    category: "agent_message" | "command" | "file_change" | "tool",
  ): void {
    this.emit(eventSink, { type: "progress", executionId, timestamp: this.timestamp(), category });
  }

  private emit(eventSink: RuntimeEventSink | undefined, event: RuntimeEvent): void {
    if (!eventSink) return;
    const parsed = runtimeEventSchema.parse(event);
    try {
      eventSink(parsed);
    } catch {
      // Observers cannot take ownership of the provider lifecycle.
    }
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
