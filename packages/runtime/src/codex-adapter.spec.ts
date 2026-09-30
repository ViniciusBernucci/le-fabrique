import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { RuntimeEvent, RuntimeExecutionRequest } from "@le-fabrique/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodexAdapter } from "./codex-adapter";

const fixture = resolve(__dirname, "fixtures/fake-codex.cjs");
let workspace = "";

function request(
  prompt: string,
  overrides: Partial<RuntimeExecutionRequest> = {},
): RuntimeExecutionRequest {
  return {
    schemaVersion: 1,
    executionId: crypto.randomUUID(),
    workspacePath: workspace,
    prompt,
    permissionMode: "READ_ONLY",
    modelRequested: null,
    limits: { timeoutMs: 2_000, maxLogBytes: 16_384 },
    ...overrides,
  };
}

function adapter(): CodexAdapter {
  return new CodexAdapter({
    binaryPath: process.execPath,
    binaryArgsPrefix: [fixture],
    environment: {
      ...process.env,
      OPENAI_API_KEY: "must-not-reach-child",
      CODEX_API_KEY: "must-not-reach-child",
    },
    forceKillAfterMs: 50,
    probeTimeoutMs: 1_000,
  });
}

beforeEach(async () => {
  workspace = await mkdtemp(resolve(tmpdir(), "le-fabrique-runtime-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("CodexAdapter", () => {
  it("executes with stdin, restricted permissions and sanitized events", async () => {
    const events: RuntimeEvent[] = [];
    const result = await adapter().execute(request("hello"), (event) => events.push(event));

    expect(result).toMatchObject({
      status: "COMPLETED",
      providerSessionId: "synthetic-thread",
      modelEffective: null,
      finalMessage: "prompt=hello;keys=false;profile=true;access=read",
      usage: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 10 },
      error: null,
    });
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "progress",
      "progress",
      "usage_observed",
      "process_exited",
      "finished",
    ]);
    expect(JSON.stringify(events)).not.toContain("private chain");
    expect(JSON.stringify(events)).not.toContain("sensitive command output");
  });

  it("selects write access only for a workspace-write request", async () => {
    const result = await adapter().execute(request("write", { permissionMode: "WORKSPACE_WRITE" }));
    expect(result.finalMessage).toBe("prompt=write;keys=false;profile=true;access=write");
  });

  it("reports ChatGPT auth and unknown quota without inventing values", async () => {
    const runtime = adapter();
    await expect(runtime.getStatus()).resolves.toMatchObject({
      state: "AVAILABLE",
      authMode: "chatgpt",
      cliVersion: "codex-cli test",
    });
    await expect(runtime.getUsage()).resolves.toMatchObject({
      state: "UNKNOWN",
      value: null,
      resetAt: null,
      source: "client-not-exposed",
    });
  });

  it("normalizes provider failures without returning raw stderr", async () => {
    const result = await adapter().execute(request("rate"));
    expect(result.status).toBe("FAILED");
    expect(result.error).toEqual({
      code: "RATE_LIMITED",
      message: "Codex usage limit reached",
      retryable: true,
    });
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });

  it.each([
    ["auth", "AUTH_REQUIRED"],
    ["context", "CONTEXT_TOO_LARGE"],
    ["denied", "TOOL_DENIED"],
    ["transient", "TRANSIENT"],
  ] as const)("normalizes %s failures as %s", async (prompt, code) => {
    const result = await adapter().execute(request(prompt));
    expect(result).toMatchObject({ status: "FAILED", error: { code } });
  });

  it("cancels and waits for the provider process to exit", async () => {
    const runtime = adapter();
    const input = request("cancel");
    const execution = runtime.execute(input);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    const cancellation = runtime.cancel(input.executionId);

    await expect(cancellation).resolves.toEqual({
      executionId: input.executionId,
      status: "CANCELLED",
    });
    await expect(execution).resolves.toMatchObject({
      status: "CANCELLED",
      error: { code: "CANCELLED" },
    });
  });

  it("terminates an execution after its timeout", async () => {
    const result = await adapter().execute(
      request("timeout", { limits: { timeoutMs: 100, maxLogBytes: 16_384 } }),
    );
    expect(result).toMatchObject({ status: "TIMED_OUT", error: { code: "TIMEOUT" } });
  });

  it("treats malformed JSONL as an unknown result", async () => {
    const result = await adapter().execute(request("malformed"));
    expect(result).toMatchObject({ status: "FAILED", error: { code: "RESULT_UNKNOWN" } });
  });

  it("stops output that exceeds the configured log limit", async () => {
    const result = await adapter().execute(
      request("large", { limits: { timeoutMs: 2_000, maxLogBytes: 1_024 } }),
    );
    expect(result).toMatchObject({ status: "FAILED", error: { code: "LOG_LIMIT" } });
  });
});
