import type {
  DigitalAgent,
  FactoryConfiguration,
  ProjectSkill,
  ProviderInstallation,
} from "@le-fabrique/contracts";

export function pruneTeamAgentInstallations(
  agents: DigitalAgent[] | undefined,
  installations: ProviderInstallation[],
): DigitalAgent[] | undefined {
  return agents?.map((agent) => {
    const account = installations.find((item) => item.id === agent.installationId);
    return agent.installationId &&
      (!account?.enabled || !agent.model || !account.models.includes(agent.model))
      ? { ...agent, installationId: null, model: null }
      : agent;
  });
}
export function removeProjectSkill(
  configuration: FactoryConfiguration,
  skillId: string,
): FactoryConfiguration {
  return {
    ...configuration,
    projectSkills: (configuration.projectSkills ?? []).filter((skill) => skill.id !== skillId),
    digitalAgents: configuration.digitalAgents?.map((agent) => ({
      ...agent,
      skillIds: agent.skillIds.filter((id) => id !== skillId),
    })),
  };
}
export function upsertProjectSkill(
  configuration: FactoryConfiguration,
  skill: ProjectSkill,
): FactoryConfiguration {
  const skills = configuration.projectSkills ?? [];
  return {
    ...configuration,
    projectSkills: skills.some((item) => item.id === skill.id)
      ? skills.map((item) => (item.id === skill.id ? skill : item))
      : [...skills, skill],
    digitalAgents: configuration.digitalAgents?.map((agent) => ({
      ...agent,
      skillIds: agent.skillIds.filter(
        (id) => id !== skill.id || agent.projectId === skill.projectId,
      ),
    })),
  };
}
