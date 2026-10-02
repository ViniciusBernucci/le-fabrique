import type { AgentRoute, EmployeeRole, RuntimeProvider } from "@le-fabrique/contracts";
import type { RuntimeAdapter } from "@le-fabrique/runtime";
import { resolveAgentRoute } from "./agent-route";
import type { ControlClient } from "./control-client";

export interface ConfiguredAgentRuntime {
  route: AgentRoute;
  adapter: RuntimeAdapter;
  configurationVersion: number;
  configurationObservedAt: string;
}

export class ConfiguredAgentRouter {
  constructor(
    private readonly control: Pick<ControlClient, "getWorkerConfiguration">,
    private readonly adapters: Partial<Record<RuntimeProvider, RuntimeAdapter>>,
  ) {}

  async resolve(role: EmployeeRole): Promise<ConfiguredAgentRuntime> {
    const snapshot = await this.control.getWorkerConfiguration();
    const route = resolveAgentRoute(snapshot.configuration, role);
    const adapter = this.adapters[route.provider];
    if (!adapter)
      throw new Error(`Configured runtime adapter for ${route.provider} is unavailable`);
    if (adapter.name !== route.provider) {
      throw new Error(`Configured runtime adapter does not match ${route.provider}`);
    }
    return {
      route,
      adapter,
      configurationVersion: snapshot.version,
      configurationObservedAt: snapshot.observedAt,
    };
  }
}
