import type {
  AgentRoute,
  EmployeeRole,
  FactoryConfiguration,
  RuntimeProvider,
} from "@le-fabrique/contracts";
import { agentRouteSchema, factoryConfigurationSchema } from "@le-fabrique/contracts";

const runtimeProviders: Partial<
  Record<FactoryConfiguration["installations"][number]["provider"], RuntimeProvider>
> = {
  CODEX: "codex",
  CLAUDE: "claude",
};

export class ProviderUnavailableError extends Error {
  constructor() {
    super("Configured provider installation is not available");
    this.name = "ProviderUnavailableError";
  }
}

export function resolveAgentRoute(
  input: FactoryConfiguration,
  role: EmployeeRole,
  excludedInstallations: readonly string[] = [],
): AgentRoute {
  const configuration = factoryConfigurationSchema.parse(input);
  const assignment = configuration.assignments.find((item) => item.role === role);
  if (!assignment?.enabled || !assignment.installationId || !assignment.model) {
    throw new Error(`No enabled route configured for ${role}`);
  }
  if (role === "REVIEWER" && assignment.permissionMode !== "READ_ONLY") {
    throw new Error("Reviewer route must be READ_ONLY");
  }
  const candidate = [
    { installationId: assignment.installationId, model: assignment.model },
    ...(assignment.alternatives ?? []),
  ].find(
    (target) =>
      !excludedInstallations.includes(target.installationId) &&
      configuration.installations.some(
        (item) =>
          item.id === target.installationId &&
          item.enabled &&
          item.authMode === "SUBSCRIPTION_CLI" &&
          item.state === "AVAILABLE" &&
          !!runtimeProviders[item.provider],
      ),
  );
  const installation = configuration.installations.find(
    (item) => item.id === candidate?.installationId,
  );
  if (!candidate || !installation) {
    const primary = configuration.installations.find(
      (item) => item.id === assignment.installationId,
    );
    if (primary && !runtimeProviders[primary.provider] && !assignment.alternatives?.length)
      throw new Error(`Configured provider for ${role} has no runtime adapter`);
    throw new ProviderUnavailableError();
  }
  const provider = runtimeProviders[installation.provider];
  if (!provider) throw new Error(`Configured provider for ${role} has no runtime adapter`);
  return agentRouteSchema.parse({
    role,
    installationId: installation.id,
    provider,
    model: candidate.model,
    permissionMode: assignment.permissionMode,
  });
}
