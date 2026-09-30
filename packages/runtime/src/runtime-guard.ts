import type {
  RuntimeGuardDecision,
  RuntimeGuardPolicy,
  RuntimeGuardState,
} from "@le-fabrique/contracts";
import {
  runtimeGuardDecisionSchema,
  runtimeGuardPolicySchema,
  runtimeGuardStateSchema,
} from "@le-fabrique/contracts";

const inheritedApiKeyNames = new Set([
  "ANTHROPIC_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "CODEX_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
]);

export interface SanitizedSubscriptionEnvironment {
  environment: NodeJS.ProcessEnv;
  removedKeys: string[];
}

export class RuntimeGuard {
  readonly policy: RuntimeGuardPolicy;

  constructor(policy: RuntimeGuardPolicy) {
    this.policy = runtimeGuardPolicySchema.parse(policy);
  }

  initialState(startedAt = new Date()): RuntimeGuardState {
    return runtimeGuardStateSchema.parse({
      schemaVersion: 1,
      startedAt: startedAt.toISOString(),
      attempts: 0,
      providerSwitches: 0,
      lastProvider: null,
      lastFailure: null,
    });
  }

  authorizeAttempt(
    inputState: RuntimeGuardState,
    provider: string,
    now = new Date(),
  ): RuntimeGuardDecision {
    const state = runtimeGuardStateSchema.parse(inputState);
    const normalizedProvider = provider.trim();
    if (!normalizedProvider || normalizedProvider.length > 120) {
      throw new Error("Provider must contain between 1 and 120 characters");
    }
    if (now.getTime() - Date.parse(state.startedAt) >= this.policy.maxElapsedMs) {
      return decision("PAUSE", "ELAPSED_TIME_LIMIT", state);
    }
    if (state.attempts >= this.policy.maxAttempts) {
      return decision("PAUSE", "ATTEMPT_LIMIT", state);
    }
    const providerSwitches =
      state.lastProvider && state.lastProvider !== normalizedProvider
        ? state.providerSwitches + 1
        : state.providerSwitches;
    if (providerSwitches > this.policy.maxProviderSwitches) {
      return decision("PAUSE", "PROVIDER_SWITCH_LIMIT", state);
    }
    return decision("ALLOW", null, {
      ...state,
      attempts: state.attempts + 1,
      providerSwitches,
      lastProvider: normalizedProvider,
    });
  }

  recordFailure(inputState: RuntimeGuardState, failureFingerprint: string): RuntimeGuardDecision {
    const state = runtimeGuardStateSchema.parse(inputState);
    const fingerprint = failureFingerprint.trim();
    if (!fingerprint || fingerprint.length > 200) {
      throw new Error("Failure fingerprint must contain between 1 and 200 characters");
    }
    const consecutiveCount =
      state.lastFailure?.fingerprint === fingerprint ? state.lastFailure.consecutiveCount + 1 : 1;
    const nextState = runtimeGuardStateSchema.parse({
      ...state,
      lastFailure: { fingerprint, consecutiveCount },
    });
    return consecutiveCount >= this.policy.repeatedFailureLimit
      ? decision("PAUSE", "REPEATED_FAILURE", nextState)
      : decision("ALLOW", null, nextState);
  }

  recordSuccess(inputState: RuntimeGuardState): RuntimeGuardState {
    const state = runtimeGuardStateSchema.parse(inputState);
    return runtimeGuardStateSchema.parse({ ...state, lastFailure: null });
  }
}

export function sanitizeSubscriptionEnvironment(
  input: NodeJS.ProcessEnv,
): SanitizedSubscriptionEnvironment {
  const environment = { ...input };
  const removedKeys: string[] = [];
  for (const key of inheritedApiKeyNames) {
    if (key in environment) {
      delete environment[key];
      removedKeys.push(key);
    }
  }
  removedKeys.sort();
  return { environment, removedKeys };
}

function decision(
  action: RuntimeGuardDecision["action"],
  reason: RuntimeGuardDecision["reason"],
  state: RuntimeGuardState,
): RuntimeGuardDecision {
  return runtimeGuardDecisionSchema.parse({ action, reason, state });
}
