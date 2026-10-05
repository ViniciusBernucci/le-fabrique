import type { RuntimeGuardPolicy } from "@le-fabrique/contracts";
import { describe, expect, it } from "vitest";
import { RuntimeGuard, sanitizeSubscriptionEnvironment } from "./runtime-guard";

const policy: RuntimeGuardPolicy = {
  schemaVersion: 1,
  maxAttempts: 2,
  maxElapsedMs: 1_000,
  maxProviderSwitches: 1,
  repeatedFailureLimit: 2,
  subscriptionOnly: true,
  monthlyApiBudget: 0,
  apiFallbackEnabled: false,
  paidExtrasAllowed: false,
};

describe("RuntimeGuard", () => {
  it("allows attempts until the configured attempt limit", () => {
    const guard = new RuntimeGuard(policy);
    const startedAt = new Date("2026-09-30T10:00:00.000Z");
    let state = guard.initialState(startedAt);
    const first = guard.authorizeAttempt(state, "codex", startedAt);
    expect(first.action).toBe("ALLOW");
    state = first.state;
    const second = guard.authorizeAttempt(state, "codex", startedAt);
    expect(second.action).toBe("ALLOW");
    expect(guard.authorizeAttempt(second.state, "codex", startedAt)).toMatchObject({
      action: "PAUSE",
      reason: "ATTEMPT_LIMIT",
    });
  });

  it("pauses on elapsed time and excessive provider switches", () => {
    const guard = new RuntimeGuard({ ...policy, maxAttempts: 5 });
    const startedAt = new Date("2026-09-30T10:00:00.000Z");
    const initial = guard.initialState(startedAt);
    expect(
      guard.authorizeAttempt(initial, "codex", new Date("2026-09-30T10:00:01.000Z")),
    ).toMatchObject({ action: "PAUSE", reason: "ELAPSED_TIME_LIMIT" });

    const first = guard.authorizeAttempt(initial, "codex", startedAt);
    const switched = guard.authorizeAttempt(first.state, "claude", startedAt);
    expect(switched.state.providerSwitches).toBe(1);
    expect(guard.authorizeAttempt(switched.state, "codex", startedAt)).toMatchObject({
      action: "PAUSE",
      reason: "PROVIDER_SWITCH_LIMIT",
    });
  });

  it("pauses after the same failure repeats and resets after success", () => {
    const guard = new RuntimeGuard(policy);
    const first = guard.recordFailure(guard.initialState(), "TOOL_DENIED:profile");
    expect(first.action).toBe("ALLOW");
    const repeated = guard.recordFailure(first.state, "TOOL_DENIED:profile");
    expect(repeated).toMatchObject({ action: "PAUSE", reason: "REPEATED_FAILURE" });
    expect(guard.recordSuccess(repeated.state).lastFailure).toBeNull();
  });

  it("rejects policies that could enable paid API capacity", () => {
    expect(
      () =>
        new RuntimeGuard({
          ...policy,
          monthlyApiBudget: 1,
          apiFallbackEnabled: true,
          paidExtrasAllowed: true,
        } as unknown as RuntimeGuardPolicy),
    ).toThrow();
  });
});

describe("sanitizeSubscriptionEnvironment", () => {
  it("removes inherited API keys without exposing their values", () => {
    const result = sanitizeSubscriptionEnvironment({
      PATH: "/usr/bin",
      OPENAI_API_KEY: "openai-secret",
      ANTHROPIC_API_KEY: "anthropic-secret",
      ANTHROPIC_AUTH_TOKEN: "anthropic-token",
      ANTHROPIC_BASE_URL: "https://api-gateway.example.test",
      AWS_ACCESS_KEY_ID: "aws-key",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      CLAUDE_CODE_OAUTH_TOKEN: "oauth-token",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_USE_VERTEX: "1",
      GOOGLE_API_KEY: "google-secret",
    });
    expect(result.environment).toEqual({ PATH: "/usr/bin" });
    expect(result.removedKeys).toEqual([
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_VERTEX",
      "GOOGLE_API_KEY",
      "OPENAI_API_KEY",
    ]);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
