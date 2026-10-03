import type { AgentRoute, EmployeeRole, RuntimeProvider } from "@le-fabrique/contracts";
import type { RuntimeAdapter } from "@le-fabrique/runtime";
import { resolveAgentRoute } from "./agent-route";
import type { ControlClient } from "./control-client";

export interface ConfiguredAgentRuntime {
  route: AgentRoute;
  adapter: RuntimeAdapter;
  timeoutMs: number;
  maxAttempts: number;
  configurationVersion: number;
  configurationObservedAt: string;
}

export class ConfiguredAgentRouter {
  constructor(
    private readonly control: Pick<ControlClient, "getWorkerConfiguration">,
    private readonly adapters:
      | Partial<Record<RuntimeProvider, RuntimeAdapter>>
      | ((route: AgentRoute) => Promise<RuntimeAdapter>),
  ) {}

  async resolve(
    role: EmployeeRole,
    excludedInstallations: readonly string[] = [],
  ): Promise<ConfiguredAgentRuntime> {
    const snapshot = await this.control.getWorkerConfiguration();
    const financialSafety = snapshot.configuration.financialSafety;
    if (
      financialSafety.apiEnabled ||
      financialSafety.extraUsageEnabled ||
      financialSafety.paidCreditsEnabled ||
      financialSafety.autoRechargeEnabled ||
      financialSafety.paidFallbackEnabled
    ) {
      throw new Error("Execution requires API, paid extras and fallback to remain disabled");
    }
    const assignment = snapshot.configuration.assignments.find((item) => item.role === role);
    if (!assignment) throw new Error(`No configured assignment for ${role}`);
    const route = resolveAgentRoute(snapshot.configuration, role, excludedInstallations);
    const adapter =
      typeof this.adapters === "function"
        ? await this.adapters(route)
        : this.adapters[route.provider];
    if (!adapter)
      throw new Error(`Configured runtime adapter for ${route.provider} is unavailable`);
    if (adapter.name !== route.provider) {
      throw new Error(`Configured runtime adapter does not match ${route.provider}`);
    }
    return {
      route,
      adapter,
      timeoutMs: assignment.timeoutMinutes * 60_000,
      maxAttempts: assignment.maxAttempts,
      configurationVersion: snapshot.version,
      configurationObservedAt: snapshot.observedAt,
    };
  }
}
