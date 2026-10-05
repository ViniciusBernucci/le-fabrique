import { describe, expect, it } from "vitest";
import { configurationSummary } from "./settings-view-model";

describe("configurationSummary", () => {
  it("keeps configured and actually available providers distinct", () => {
    const settings = {
      version: 1,
      createdAt: "2026-10-01T12:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
      configuration: {
        installations: [
          {
            id: "codex-main",
            provider: "CODEX" as const,
            label: "Codex",
            executable: "codex",
            enabled: true,
            state: "AUTH_REQUIRED" as const,
            authMode: "SUBSCRIPTION_CLI" as const,
            models: ["gpt-test"],
            defaultModel: "gpt-test",
          },
        ],
        assignments: [
          {
            role: "DEVELOPER" as const,
            enabled: true,
            installationId: "codex-main",
            model: "gpt-test",
            permissionMode: "WORKSPACE_WRITE" as const,
            timeoutMinutes: 30,
            maxAttempts: 2,
          },
        ],
        github: {
          authMode: "GH_CLI" as const,
          state: "DISCONNECTED" as const,
          host: "github.com",
          owner: null,
          repository: null,
          baseBranch: "main",
          pullRequestCreationEnabled: false,
          mergeEnabled: false as const,
        },
        financialSafety: {
          apiEnabled: false as const,
          extraUsageEnabled: false as const,
          paidCreditsEnabled: false as const,
          autoRechargeEnabled: false as const,
          paidFallbackEnabled: false as const,
        },
      },
    };

    expect(configurationSummary(settings as never)).toEqual({
      enabledInstallations: 1,
      availableInstallations: 0,
      assignedEmployees: 1,
      githubConnected: false,
    });
  });
});

describe("observed account models", () => {
  it("preserves draft edits while making discovered models available to employee selectors", async () => {
    const { mergeObservedInstallations } = await import("./settings-view-model");
    const installation = {
      id: "codex-default",
      provider: "CODEX",
      label: "Draft label",
      state: "AUTH_REQUIRED",
      models: ["manual-model"],
      defaultModel: null,
    };
    const draft = { installations: [installation], assignments: [] };
    const saved = {
      installations: [
        {
          ...installation,
          label: "Saved label",
          state: "AVAILABLE",
          models: ["discovered-model"],
          defaultModel: "discovered-model",
        },
      ],
    };
    const result = mergeObservedInstallations(draft as never, saved as never);
    expect(result.installations[0]).toMatchObject({
      label: "Draft label",
      state: "AVAILABLE",
      models: ["manual-model", "discovered-model"],
      defaultModel: "discovered-model",
    });
    expect(draft.installations[0]?.models).toEqual(["manual-model"]);
  });
});
