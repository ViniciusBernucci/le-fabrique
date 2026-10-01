import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { RuntimeEvent, RuntimeExecutionRequest } from "@le-fabrique/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeAdapter } from "./claude-adapter";

const fixture = resolve(__dirname, "fixtures/fake-claude.cjs");
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

function adapter(): ClaudeAdapter {
  return new ClaudeAdapter({
    binaryPath: process.execPath,
    binaryArgsPrefix: [fixture],
    environment: {
      ...process.env,
      ANTHROPIC_API_KEY: "must-not-reach-child",
      ANTHROPIC_AUTH_TOKEN: "must-not-reach-child",
      ANTHROPIC_BASE_URL: "https://gateway.example.test",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_USE_VERTEX: "1",
      AWS_ACCESS_KEY_ID: "must-not-reach-child",
      AWS_SECRET_ACCESS_KEY: "must-not-reach-child",
      CLAUDE_CODE_OAUTH_TOKEN: "must-not-reach-child",
    },
    forceKillAfterMs: 50,
    probeTimeoutMs: 1_000,
  });
}

beforeEach(async () => {
  workspace = await mkdtemp(resolve(tmpdir(), "le-fabrique-claude-runtime-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("ClaudeAdapter", () => {
  it("uses a restricted read-only profile and sanitizes stream events", async () => {
    const events: RuntimeEvent[] = [];
    const result = await adapter().execute(request("hello"), (event) => events.push(event));

    expect(result).toMatchObject({
      provider: "claude",
      status: "COMPLETED",
      providerSessionId: "synthetic-claude-session",
      modelEffective: "synthetic-claude",
      finalMessage: "prompt=hello;keys=false;profile=true;access=read",
      usage: { inputTokens: 80, cachedInputTokens: 20, outputTokens: 8 },
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
    expect(JSON.stringify(events)).not.toContain("private reasoning");
    expect(JSON.stringify(events)).not.toContain("private: true");
  });

  it("allows file tools only for workspace-write", async () => {
    const result = await adapter().execute(
      request("write", { permissionMode: "WORKSPACE_WRITE", modelRequested: "synthetic-model" }),
    );
    expect(result.finalMessage).toBe("prompt=write;keys=false;profile=true;access=write");
    expect(result.modelRequested).toBe("synthetic-model");
  });

  it("accepts only an explicit Claude subscription auth method", async () => {
    const runtime = adapter();
    await expect(runtime.getStatus()).resolves.toMatchObject({
      provider: "claude",
      state: "AVAILABLE",
      authMode: "claude-subscription",
      cliVersion: "2.1.285 (Claude Code)",
    });
    await expect(runtime.getUsage()).resolves.toMatchObject({
      provider: "claude",
      state: "UNKNOWN",
      source: "client-not-exposed",
    });
  });

  it("fails closed for ambiguous or non-first-party authentication", async () => {
    const ambiguous = new ClaudeAdapter({
      binaryPath: process.execPath,
      binaryArgsPrefix: [fixture],
      environment: { ...process.env, FAKE_CLAUDE_AUTH_METHOD: "oauth" },
    });
    const thirdParty = new ClaudeAdapter({
      binaryPath: process.execPath,
      binaryArgsPrefix: [fixture],
      environment: { ...process.env, FAKE_CLAUDE_API_PROVIDER: "bedrock" },
    });
    const loggedOut = new ClaudeAdapter({
      binaryPath: process.execPath,
      binaryArgsPrefix: [fixture],
      environment: { ...process.env, FAKE_CLAUDE_LOGGED_IN: "false" },
    });
    await expect(ambiguous.getStatus()).resolves.toMatchObject({ state: "ERROR" });
    await expect(thirdParty.getStatus()).resolves.toMatchObject({ state: "ERROR" });
    await expect(loggedOut.getStatus()).resolves.toMatchObject({ state: "AUTH_REQUIRED" });
  });

  it.each([
    ["auth", "AUTH_REQUIRED"],
    ["rate", "RATE_LIMITED"],
    ["context", "CONTEXT_TOO_LARGE"],
    ["denied", "TOOL_DENIED"],
    ["transient", "TRANSIENT"],
  ] as const)("normalizes %s without returning raw provider output", async (prompt, code) => {
    const result = await adapter().execute(request(prompt));
    expect(result).toMatchObject({ status: "FAILED", error: { code } });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("cancels and waits for the provider process to exit", async () => {
    const runtime = adapter();
    const input = request("cancel");
    const execution = runtime.execute(input);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    await expect(runtime.cancel(input.executionId)).resolves.toEqual({
      executionId: input.executionId,
      status: "CANCELLED",
    });
    await expect(execution).resolves.toMatchObject({
      status: "CANCELLED",
      error: { code: "CANCELLED" },
    });
  });

  it("enforces timeout, JSONL and output limits", async () => {
    await expect(
      adapter().execute(request("timeout", { limits: { timeoutMs: 100, maxLogBytes: 16_384 } })),
    ).resolves.toMatchObject({ status: "TIMED_OUT", error: { code: "TIMEOUT" } });
    await expect(adapter().execute(request("malformed"))).resolves.toMatchObject({
      status: "FAILED",
      error: { code: "RESULT_UNKNOWN" },
    });
    await expect(
      adapter().execute(request("large", { limits: { timeoutMs: 2_000, maxLogBytes: 1_024 } })),
    ).resolves.toMatchObject({ status: "FAILED", error: { code: "LOG_LIMIT" } });
  });
});
