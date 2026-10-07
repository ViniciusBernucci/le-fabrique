import { describe, expect, it } from "vitest";
import {
  assignAutomatically,
  demoOnboarding,
  removeExamples,
  validateTask,
  workspaceSchema,
} from "./tasks-model";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing fixture");
  return value;
}

describe("task demo onboarding and assignment boundaries", () => {
  it("creates the project and enabled team before assigning every example", () => {
    const workspace = workspaceSchema.parse(demoOnboarding());
    expect(workspace.tasks).toHaveLength(9);
    for (const task of workspace.tasks) {
      expect(validateTask(task, workspace.tasks, workspace.projects, workspace.agents)).toEqual(
        task,
      );
      expect(
        workspace.agents.some(
          (agent) => agent.id === task.assigneeId && agent.projectId === task.projectId,
        ),
      ).toBe(true);
    }
  });
  it("blocks automatic assignment without enabled project agents", () => {
    const workspace = demoOnboarding();
    const task = required(workspace.tasks[0]);
    expect(() => assignAutomatically(task, [])).toThrow("Crie e habilite agentes");
    expect(() =>
      assignAutomatically(
        task,
        workspace.agents.map((agent) => ({ ...agent, enabled: false })),
      ),
    ).toThrow();
    expect(() =>
      assignAutomatically({ ...task, projectId: "another-project" }, workspace.agents),
    ).toThrow();
    expect(assignAutomatically({ ...task, assigneeId: null }, workspace.agents).assigneeId).toBe(
      required(workspace.agents[0]).id,
    );
  });
  it("allows unassigned drafts and rejects foreign or disabled owners", () => {
    const workspace = demoOnboarding();
    const task = required(workspace.tasks[0]);
    expect(
      validateTask({ ...task, assigneeId: null }, workspace.tasks, workspace.projects, []),
    ).toMatchObject({ assigneeId: null });
    expect(() =>
      validateTask(
        task,
        workspace.tasks,
        workspace.projects,
        workspace.agents.map((agent) => ({ ...agent, projectId: "foreign" })),
      ),
    ).toThrow("deste projeto");
    expect(() =>
      validateTask(
        task,
        workspace.tasks,
        workspace.projects,
        workspace.agents.map((agent) => ({ ...agent, enabled: false })),
      ),
    ).toThrow("deste projeto");
  });
  it("rejects self, missing, foreign and cyclic dependencies", () => {
    const workspace = demoOnboarding();
    const first = required(workspace.tasks[0]);
    const second = required(workspace.tasks[1]);
    const third = required(workspace.tasks[2]);
    const validate = (dependencies: string[], tasks = workspace.tasks) =>
      validateTask({ ...first, dependencies }, tasks, workspace.projects, workspace.agents);
    expect(() => validate([first.id])).toThrow();
    expect(() => validate(["missing"])).toThrow();
    expect(() => validate([second.id], [{ ...second, projectId: "foreign" }])).toThrow();
    expect(() =>
      validate(
        [second.id],
        [
          { ...second, dependencies: [third.id] },
          { ...third, dependencies: [first.id] },
        ],
      ),
    ).toThrow("ciclo");
    expect(validate([second.id]).dependencies).toEqual([second.id]);
  });
  it("removes examples without deleting manual tasks, teams or valid manual dependencies", () => {
    const workspace = demoOnboarding();
    const manual = {
      ...required(workspace.tasks[0]),
      id: "manual",
      origin: "manual" as const,
      dependencies: [required(workspace.tasks[1]).id, "other-manual"],
    };
    const other = { ...manual, id: "other-manual", dependencies: [] };
    const clean = removeExamples({ ...workspace, tasks: [...workspace.tasks, manual, other] });
    expect(clean.tasks.map((task) => task.id)).toEqual(["manual", "other-manual"]);
    expect(required(clean.tasks[0]).dependencies).toEqual(["other-manual"]);
    expect(clean.agents).toEqual(workspace.agents);
    expect(clean.projects).toEqual(workspace.projects);
  });
  it("validates stored payloads and rejects impossible dates or missing specifications", () => {
    const workspace = demoOnboarding();
    expect(workspaceSchema.parse(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
    expect(workspaceSchema.safeParse({ schemaVersion: 0 }).success).toBe(false);
    expect(() =>
      validateTask(
        { ...required(workspace.tasks[0]), dueDate: "2026-02-30" },
        workspace.tasks,
        workspace.projects,
        workspace.agents,
      ),
    ).toThrow();
    expect(() =>
      validateTask(
        { ...required(workspace.tasks[0]), specification: " " },
        workspace.tasks,
        workspace.projects,
        workspace.agents,
      ),
    ).toThrow();
  });
});
