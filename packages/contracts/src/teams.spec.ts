import { describe, expect, it } from "vitest";
import { factoryConfigurationSchema, projectSkillSchema } from "./index";

const projectId = crypto.randomUUID();
const skillId = crypto.randomUUID();
const base = {
  installations: [],
  assignments: ["PLANNER", "DEVELOPER", "REVIEWER", "QA", "DOCUMENTATION", "SECURITY"].map(
    (role) => ({
      role,
      enabled: false,
      installationId: null,
      model: null,
      permissionMode: "READ_ONLY",
      timeoutMinutes: 10,
      maxAttempts: 1,
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
};
const skill = {
  id: skillId,
  projectId,
  name: " Revisão de UI ",
  description: "Padrões do projeto",
  instructions: "Verifique o padrão visual e a acessibilidade.",
};
const agent = {
  id: crypto.randomUUID(),
  projectId,
  name: "Designer",
  description: "",
  instructions: "",
  installationId: null,
  model: null,
  enabled: true,
  skillIds: [skillId],
};

describe("project skills and digital agents", () => {
  it("keeps legacy configurations valid without registering synthetic skills or agents", () => {
    const result = factoryConfigurationSchema.parse(base);
    expect(result.digitalAgents).toBeUndefined();
    expect(result.projectSkills).toBeUndefined();
    expect(result.assignments).toHaveLength(6);
  });
  it("accepts more than six registered agents and validates skill content in runtime", () => {
    const agents = Array.from({ length: 25 }, (_, index) => ({
      ...agent,
      id: crypto.randomUUID(),
      name: `Agente ${index}`,
    }));
    const result = factoryConfigurationSchema.parse({
      ...base,
      digitalAgents: agents,
      projectSkills: [skill],
    });
    expect(result.digitalAgents).toHaveLength(25);
    expect(result.projectSkills?.[0]?.name).toBe("Revisão de UI");
  });
  it("rejects duplicate ids, unknown skills, and skill references from a different project", () => {
    for (const digitalAgents of [
      [agent, agent],
      [{ ...agent, skillIds: [skillId, skillId] }],
      [{ ...agent, skillIds: [crypto.randomUUID()] }],
      [{ ...agent, projectId: crypto.randomUUID() }],
    ]) {
      expect(
        factoryConfigurationSchema.safeParse({ ...base, digitalAgents, projectSkills: [skill] })
          .success,
      ).toBe(false);
    }
    expect(
      factoryConfigurationSchema.safeParse({
        ...base,
        digitalAgents: [agent],
        projectSkills: [skill, skill],
      }).success,
    ).toBe(false);
  });
  it("rejects forged account/model pairs, missing project, empty instructions and credential fields", () => {
    expect(
      factoryConfigurationSchema.safeParse({
        ...base,
        digitalAgents: [{ ...agent, installationId: "codex-test", model: null }],
        projectSkills: [skill],
      }).success,
    ).toBe(false);
    expect(projectSkillSchema.safeParse({ ...skill, projectId: null }).success).toBe(false);
    expect(projectSkillSchema.safeParse({ ...skill, instructions: "   " }).success).toBe(false);
    expect(projectSkillSchema.safeParse({ ...skill, apiKey: "forbidden" }).success).toBe(false);
  });
});
