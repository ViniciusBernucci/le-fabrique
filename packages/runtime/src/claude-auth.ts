import type { ProviderState } from "@le-fabrique/contracts";

const subscriptionAuthMethods = new Set(["claude.ai", "claudeai", "subscription"]);

export function classifyClaudeSubscriptionStatus(input: unknown): ProviderState {
  if (!isRecord(input)) return "ERROR";
  if (input.loggedIn === false) return "AUTH_REQUIRED";
  if (
    input.loggedIn === true &&
    typeof input.authMethod === "string" &&
    subscriptionAuthMethods.has(input.authMethod.toLowerCase()) &&
    input.apiProvider === "firstParty"
  ) {
    return "AVAILABLE";
  }
  return "ERROR";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
