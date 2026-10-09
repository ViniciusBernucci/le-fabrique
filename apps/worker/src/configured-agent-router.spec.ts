import type {
  EmployeeRole,
  FactoryConfiguration,
  RuntimeProvider,
  WorkerConfigurationSnapshot,
} from "@le-fabrique/contracts";
import { factoryConfigurationSchema } from "@le-fabrique/contracts";
import type { RuntimeAdapter } from "@le-fabrique/runtime";
import { describe, expect, it, vi } from "vitest";
import { ConfiguredAgentRouter } from "./configured-agent-router";

const observedAt = "2026-10-02T12:00:00.000Z";
const roles: EmployeeRole[] = [
  "PLANNER",
  "DEVELOPER",
  "REVIEWER",
  "QA",
  "DOCUMENTATION",
  "SECURITY",
];

function configuration(
  options: {
    developerModel?: string;
    developerProvider?: "CODEX" | "ANTIGRAVITY";
    developerState?: "AVAILABLE" | "AUTH_REQUIRED";
    reviewerPermission?: "READ_ONLY" | "WORKSPACE_WRITE";
  } = {},
): FactoryConfiguration {
  const developerModel = options.developerModel ?? "codex-model-a";
  const developerProvider = options.developerProvider ?? "CODEX";
  return {
    installations: [
      {
        id: "codex-installation",
        provider: "CODEX",
        label: "Configurado no painel",
        executable: "codex",
        enabled: true,
        state: options.developerState ?? "AVAILABLE",
        authMode: "SUBSCRIPTION_CLI",
        models: ["codex-model-a", "codex-model-b"],
        defaultModel: "codex-model-a",
      },
      {
        id: "claude-installation",
        provider: "CLAUDE",
        label: "Outra conta configurada",
        executable: "claude",
        enabled: true,
        state: "AVAILABLE",
        authMode: "SUBSCRIPTION_CLI",
        models: ["claude-model"],
        defaultModel: "claude-model",
      },
      ...(developerProvider === "ANTIGRAVITY"
        ? [
            {
              id: "antigravity-installation",
              provider: "ANTIGRAVITY" as const,
              label: "Sem adapter de runtime",
              executable: "agy",
              enabled: true,
              state: "AVAILABLE" as const,
              authMode: "SUBSCRIPTION_CLI" as const,
              models: [developerModel],
              defaultModel: developerModel,
            },
          ]
        : []),
    ],
    assignments: roles.map((role) => ({
      role,
      enabled: role === "DEVELOPER" || role === "REVIEWER",
      installationId:
        role === "DEVELOPER"
          ? developerProvider === "CODEX"
            ? "codex-installation"
            : "antigravity-installation"
          : role === "REVIEWER"
            ? "claude-installation"
            : null,
      model: role === "DEVELOPER" ? developerModel : role === "REVIEWER" ? "claude-model" : null,
      permissionMode:
        role === "DEVELOPER"
          ? "WORKSPACE_WRITE"
          : role === "REVIEWER"
            ? (options.reviewerPermission ?? "READ_ONLY")
            : "READ_ONLY",
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

function snapshot(version: number, config: FactoryConfiguration): WorkerConfigurationSnapshot {
  return { version, observedAt, configuration: config };
}

function adapter(provider: RuntimeProvider): RuntimeAdapter {
  return { name: provider } as RuntimeAdapter;
}

describe("ConfiguredAgentRouter", () => {
  it("uses only explicitly configured alternative accounts and keeps the role limits", async () => {
    const config = configuration({ developerState: "AUTH_REQUIRED" });
    const assignment = config.assignments.find((item) => item.role === "DEVELOPER");
    if (!assignment) throw new Error("Missing fixture assignment");
    const control = { getWorkerConfiguration: vi.fn(async () => snapshot(14, config)) };
    const router = new ConfiguredAgentRouter(control as never, {
      codex: adapter("codex"),
      claude: adapter("claude"),
    });
    await expect(router.resolve("DEVELOPER")).rejects.toThrow("not available");
    assignment.alternatives = [{ installationId: "claude-installation", model: "claude-model" }];
    await expect(router.resolve("DEVELOPER")).resolves.toMatchObject({
      route: {
        installationId: "claude-installation",
        model: "claude-model",
        permissionMode: "WORKSPACE_WRITE",
      },
      maxAttempts: 2,
      timeoutMs: 30 * 60 * 1000,
    });
    await expect(router.resolve("DEVELOPER", ["claude-installation"])).rejects.toThrow(
      "not available",
    );
  });
  it.each(["duplicate", "missing", "model", "too-many", "without-primary"])(
    "rejects invalid alternative configuration: %s",
    (invalid) => {
      const config = configuration();
      const assignment = config.assignments.find((item) => item.role === "DEVELOPER");
      if (!assignment) throw new Error("Missing fixture assignment");
      assignment.alternatives = [{ installationId: "claude-installation", model: "claude-model" }];
      if (invalid === "duplicate")
        assignment.alternatives[0] = {
          installationId: "codex-installation",
          model: "codex-model-a",
        };
      if (invalid === "missing") assignment.alternatives[0].installationId = "unknown-installation";
      if (invalid === "model") assignment.alternatives[0].model = "unknown-model";
      if (invalid === "too-many")
        assignment.alternatives.push(...assignment.alternatives, ...assignment.alternatives);
      if (invalid === "without-primary") {
        assignment.installationId = null;
        assignment.model = null;
      }
      expect(factoryConfigurationSchema.safeParse(config).success).toBe(false);
    },
  );
  it("constructs the adapter for each currently selected installation, including same-provider accounts", async () => {
    const first = configuration();
    const second = configuration();
    const installation = second.installations.find((item) => item.id === "codex-installation");
    const assignment = second.assignments.find((item) => item.role === "DEVELOPER");
    if (!installation || !assignment) throw new Error("Missing fixture installation");
    installation.id = "codex-second-account";
    assignment.installationId = installation.id;
    const getWorkerConfiguration = vi
      .fn()
      .mockResolvedValueOnce(snapshot(12, first))
      .mockResolvedValueOnce(snapshot(13, second));
    const factory = vi.fn(async () => adapter("codex"));
    const router = new ConfiguredAgentRouter({ getWorkerConfiguration } as never, factory);
    await router.resolve("DEVELOPER");
    await router.resolve("DEVELOPER");
    expect(
      factory.mock.calls.map(
        (call) => (call as unknown as [{ installationId: string }])[0].installationId,
      ),
    ).toEqual(["codex-installation", "codex-second-account"]);
  });
  it("resolves the latest UI-selected account/model and reads settings on each call", async () => {
    const getWorkerConfiguration = vi
      .fn()
      .mockResolvedValueOnce(snapshot(4, configuration()))
      .mockResolvedValueOnce(snapshot(5, configuration({ developerModel: "codex-model-b" })));
    const codex = adapter("codex");
    const router = new ConfiguredAgentRouter({ getWorkerConfiguration } as never, { codex });

    await expect(router.resolve("DEVELOPER")).resolves.toMatchObject({
      route: {
        role: "DEVELOPER",
        installationId: "codex-installation",
        provider: "codex",
        model: "codex-model-a",
        permissionMode: "WORKSPACE_WRITE",
      },
      adapter: codex,
      configurationVersion: 4,
      configurationObservedAt: observedAt,
      timeoutMs: 30 * 60_000,
      maxAttempts: 2,
    });
    await expect(router.resolve("DEVELOPER")).resolves.toMatchObject({
      route: { model: "codex-model-b" },
      configurationVersion: 5,
    });

    expect(getWorkerConfiguration).toHaveBeenCalledTimes(2);
  });

  it("rejects a Reviewer assignment that requests write permissions", async () => {
    const router = new ConfiguredAgentRouter(
      {
        getWorkerConfiguration: async () =>
          snapshot(6, configuration({ reviewerPermission: "WORKSPACE_WRITE" })),
      } as never,
      { claude: adapter("claude") },
    );

    await expect(router.resolve("REVIEWER")).rejects.toThrow("Reviewer route must be READ_ONLY");
  });

  it("selects the configured Reviewer model with read-only permission", async () => {
    const claude = adapter("claude");
    const router = new ConfiguredAgentRouter(
      { getWorkerConfiguration: async () => snapshot(6, configuration()) } as never,
      { claude },
    );

    await expect(router.resolve("REVIEWER")).resolves.toMatchObject({
      route: {
        role: "REVIEWER",
        installationId: "claude-installation",
        provider: "claude",
        model: "claude-model",
        permissionMode: "READ_ONLY",
      },
      adapter: claude,
      configurationVersion: 6,
    });
  });

  it("does not fall back when the configured installation is unavailable", async () => {
    const router = new ConfiguredAgentRouter(
      {
        getWorkerConfiguration: async () =>
          snapshot(7, configuration({ developerState: "AUTH_REQUIRED" })),
      } as never,
      { codex: adapter("codex"), claude: adapter("claude") },
    );

    await expect(router.resolve("DEVELOPER")).rejects.toThrow("not available");
  });

  it("fails closed when the selected provider has no registered adapter", async () => {
    const router = new ConfiguredAgentRouter(
      {
        getWorkerConfiguration: async () =>
          snapshot(
            8,
            configuration({ developerProvider: "ANTIGRAVITY", developerModel: "agy-model" }),
          ),
      } as never,
      { codex: adapter("codex"), claude: adapter("claude") },
    );

    await expect(router.resolve("DEVELOPER")).rejects.toThrow("no runtime adapter");
  });

  it("fails closed instead of substituting another provider when its adapter is missing", async () => {
    const router = new ConfiguredAgentRouter(
      { getWorkerConfiguration: async () => snapshot(9, configuration()) } as never,
      {},
    );

    await expect(router.resolve("DEVELOPER")).rejects.toThrow("adapter for codex is unavailable");
  });

  it("rejects an adapter registered under the wrong provider", async () => {
    const router = new ConfiguredAgentRouter(
      { getWorkerConfiguration: async () => snapshot(10, configuration()) } as never,
      { codex: adapter("claude") as never },
    );

    await expect(router.resolve("DEVELOPER")).rejects.toThrow("adapter does not match codex");
  });

  it("fails closed if saved financial settings enable API, paid usage, or fallback", async () => {
    const unsafeConfiguration = configuration();
    unsafeConfiguration.financialSafety.extraUsageEnabled = true;
    const router = new ConfiguredAgentRouter(
      { getWorkerConfiguration: async () => snapshot(11, unsafeConfiguration) } as never,
      { codex: adapter("codex") },
    );

    await expect(router.resolve("DEVELOPER")).rejects.toThrow(
      "Execution requires API, paid extras and fallback to remain disabled",
    );
  });
});

it("never uses a subscription adapter for an API key installation", async () => {
  const config = configuration();
  config.installations[0].authMode = "API_KEY";
  const createAdapter = vi.fn(async () => adapter("codex"));
  const router = new ConfiguredAgentRouter(
    { getWorkerConfiguration: async () => snapshot(1, config) },
    createAdapter,
  );
  await expect(router.resolve("DEVELOPER")).rejects.toThrow("not available");
  expect(createAdapter).not.toHaveBeenCalled();
});
