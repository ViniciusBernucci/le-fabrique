import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { WorkerSettingsController } from "./worker-settings.controller";

describe("WorkerSettingsController", () => {
  it("returns a runtime-validated snapshot and requires the worker guard", async () => {
    const snapshot = {
      version: 0,
      observedAt: "2026-10-02T12:00:00.000Z",
      configuration: {
        installations: [],
        assignments: ["PLANNER", "DEVELOPER", "REVIEWER", "QA", "DOCUMENTATION", "SECURITY"].map(
          (role) => ({
            role,
            enabled: false,
            installationId: null,
            model: null,
            permissionMode: role === "DEVELOPER" ? "WORKSPACE_WRITE" : "READ_ONLY",
            timeoutMinutes: 30,
            maxAttempts: 2,
          }),
        ),
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
      },
    };
    const settings = { getWorkerConfigurationSnapshot: async () => snapshot };
    const controller = new WorkerSettingsController(settings as never);

    await expect(controller.getConfiguration()).resolves.toEqual(snapshot);
    expect(Reflect.getMetadata(GUARDS_METADATA, WorkerSettingsController)).toContain(
      WorkerAuthGuard,
    );
  });
});
