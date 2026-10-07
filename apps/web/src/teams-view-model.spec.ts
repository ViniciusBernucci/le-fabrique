import type { DigitalAgent, FactoryConfiguration, ProjectSkill } from "@le-fabrique/contracts";
import { expect, it } from "vitest";
import {
  pruneTeamAgentInstallations,
  removeProjectSkill,
  upsertProjectSkill,
} from "./teams-view-model";

const skill: ProjectSkill = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  name: "Skill",
  description: "",
  instructions: "Review",
};
const agent: DigitalAgent = {
  id: crypto.randomUUID(),
  projectId: skill.projectId,
  name: "Agent",
  description: "",
  instructions: "",
  installationId: "codex-test",
  model: "model-test",
  skillIds: [skill.id],
  enabled: true,
};
const config = { projectSkills: [skill], digitalAgents: [agent] } as FactoryConfiguration;
it("removing a skill removes its associations without removing agents", () => {
  const next = removeProjectSkill(config, skill.id);
  expect(next.projectSkills).toEqual([]);
  expect(next.digitalAgents?.[0]?.skillIds).toEqual([]);
  expect(config.digitalAgents?.[0]?.skillIds).toEqual([skill.id]);
});
it("moving a skill to another project unlinks only references that no longer belong", () => {
  const next = upsertProjectSkill(config, { ...skill, projectId: crypto.randomUUID() });
  expect(next.digitalAgents?.[0]?.skillIds).toEqual([]);
  expect(next.projectSkills).toHaveLength(1);
});
it("removing or disabling a model clears only its agent account while keeping project skills", () => {
  const pruned = pruneTeamAgentInstallations([agent], []);
  expect(pruned?.[0]).toMatchObject({
    installationId: null,
    model: null,
    skillIds: [skill.id],
    projectId: skill.projectId,
  });
});
