import type { FactoryConfiguration } from "@le-fabrique/contracts";

const roles = ["PLANNER", "DEVELOPER", "REVIEWER", "QA", "DOCUMENTATION", "SECURITY"] as const;

export function createDefaultFactoryConfiguration(): FactoryConfiguration {
  return {
    installations: [
      {
        id: "codex-default",
        provider: "CODEX",
        label: "Codex",
        executable: "codex",
        enabled: false,
        state: "AUTH_REQUIRED",
        authMode: "SUBSCRIPTION_CLI",
        models: [],
        defaultModel: null,
      },
      {
        id: "claude-default",
        provider: "CLAUDE",
        label: "Claude Code",
        executable: "claude",
        enabled: false,
        state: "AUTH_REQUIRED",
        authMode: "SUBSCRIPTION_CLI",
        models: [],
        defaultModel: null,
      },
      {
        id: "antigravity-default",
        provider: "ANTIGRAVITY",
        label: "Antigravity",
        executable: "agy",
        enabled: false,
        state: "AUTH_REQUIRED",
        authMode: "SUBSCRIPTION_CLI",
        models: [],
        defaultModel: null,
      },
    ],
    assignments: roles.map((role) => ({
      role,
      enabled: false,
      installationId: null,
      model: null,
      permissionMode: role === "DEVELOPER" ? "WORKSPACE_WRITE" : "READ_ONLY",
      timeoutMinutes: 30,
      maxAttempts: 2,
    })),
    github: {
      authMode: "GH_CLI",
      state: "DISCONNECTED",
      host: "github.com",
      owner: null,
      repository: null,
      baseBranch: "main",
      pullRequestCreationEnabled: false,
      mergeEnabled: false,
    },
    financialSafety: {
      apiEnabled: false,
      extraUsageEnabled: false,
      paidCreditsEnabled: false,
      autoRechargeEnabled: false,
      paidFallbackEnabled: false,
    },
  };
}
