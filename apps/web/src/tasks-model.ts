import { z } from "zod";

export const TASKS_STORAGE_KEY = "le-fabrique.tasks.demo.v1";
export const stages = [
  "Backlog",
  "Pronto",
  "Em andamento",
  "Revisão",
  "QA",
  "Documentação",
  "Aceite",
  "Concluído",
  "Bloqueado",
] as const;
export const phases = [
  "Descoberta",
  "Arquitetura",
  "Planejamento",
  "Implementação",
  "Validação",
  "Entrega",
] as const;
export const priorities = ["Baixa", "Normal", "Alta", "Urgente"] as const;
export type TaskProject = { id: string; name: string };
export type TaskAgent = { id: string; name: string; projectId: string | null; enabled: boolean };
export const taskSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  specification: z.string().trim().min(1).max(4000),
  criteria: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  assigneeId: z.string().nullable(),
  stage: z.enum(stages),
  phase: z.enum(phases),
  priority: z.enum(priorities),
  dueDate: z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value),
      "Prazo inválido",
    ),
  dependencies: z.array(z.string()),
  origin: z.enum(["example", "manual"]),
  history: z.array(z.object({ at: z.iso.datetime(), description: z.string() })),
});
export type Task = z.infer<typeof taskSchema>;
export const workspaceSchema = z.object({
  schemaVersion: z.literal(1),
  projects: z.array(z.object({ id: z.string(), name: z.string() })),
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      projectId: z.string().nullable(),
      enabled: z.boolean(),
    }),
  ),
  tasks: z.array(taskSchema),
});
export type TasksWorkspace = z.infer<typeof workspaceSchema>;

// TODO FAC-033: replace this isolated demo source with the project's onboarding API.
// Never submit these examples to the execution outbox.
export function demoOnboarding(): TasksWorkspace {
  const project = { id: "demo-factory", name: "La fabrique · demonstração" };
  const agents: TaskAgent[] = ["Tech Lead", "Desenvolvedor", "Revisor", "QA", "Documentação"].map(
    (name, index) => ({ id: `demo-agent-${index}`, name, projectId: project.id, enabled: true }),
  );
  const samples = [
    ["Mapear requisitos do onboarding", "Descoberta", "Concluído", 0, "Alta"],
    ["Definir contratos de tarefas", "Arquitetura", "Revisão", 2, "Alta"],
    ["Preparar backlog do projeto", "Planejamento", "Pronto", 0, "Normal"],
    ["Construir painel de tarefas", "Implementação", "Em andamento", 1, "Alta"],
    ["Validar atribuição de responsáveis", "Validação", "QA", 3, "Urgente"],
    ["Documentar o fluxo da equipe", "Entrega", "Documentação", 4, "Normal"],
    ["Revisar experiência do onboarding", "Validação", "Aceite", 3, "Normal"],
    ["Adicionar filtros ao painel", "Implementação", "Backlog", 1, "Baixa"],
    ["Conectar a persistência compartilhada", "Implementação", "Bloqueado", 1, "Alta"],
  ] as const;
  const now = new Date().toISOString();
  const tasks = samples.map(
    ([title, phase, stage, agent, priority], index): Task => ({
      id: `demo-task-${index}`,
      code: `DEMO-${String(index + 1).padStart(3, "0")}`,
      projectId: project.id,
      title,
      phase,
      stage,
      priority,
      assigneeId: `demo-agent-${agent}`,
      dueDate: "",
      dependencies: [],
      origin: "example",
      specification: `Exemplo para testar: ${title.toLocaleLowerCase("pt-BR")}. Dados sintéticos gerados pelo onboarding demonstrativo.`,
      criteria: [
        "Comportamento pode ser verificado manualmente",
        "Resultado e limitações estão registrados",
      ],
      history: [
        {
          at: now,
          description: `Onboarding demonstrativo criou o projeto, a equipe e atribuiu a ${agents[agent]?.name ?? "Equipe"}.`,
        },
      ],
    }),
  );
  return { schemaVersion: 1, projects: [project], agents, tasks };
}

export function validateTask(
  task: Task,
  tasks: Task[],
  projects: TaskProject[],
  agents: TaskAgent[],
): Task {
  const result = taskSchema.safeParse(task);
  if (!result.success)
    throw new Error(
      "Preencha título, especificação e de 1 a 20 critérios. Confira os limites dos campos e o prazo.",
    );
  const valid = result.data;
  if (!projects.some((project) => project.id === valid.projectId))
    throw new Error("Selecione um projeto disponível.");
  if (
    valid.assigneeId &&
    !agents.some(
      (agent) =>
        agent.id === valid.assigneeId && agent.projectId === valid.projectId && agent.enabled,
    )
  )
    throw new Error("Escolha um agente habilitado deste projeto.");
  if (new Set(valid.dependencies).size !== valid.dependencies.length)
    throw new Error("Dependência duplicada.");
  for (const id of valid.dependencies) {
    const dependency = tasks.find((item) => item.id === id);
    if (id === valid.id || !dependency || dependency.projectId !== valid.projectId)
      throw new Error("Dependências devem ser outras tarefas deste projeto.");
    const visited = new Set<string>();
    function reachesCurrent(current: string): boolean {
      if (current === valid.id) return true;
      if (visited.has(current)) return false;
      visited.add(current);
      return tasks.find((item) => item.id === current)?.dependencies.some(reachesCurrent) ?? false;
    }
    if (reachesCurrent(id)) throw new Error("Esta dependência criaria um ciclo entre tarefas.");
  }
  return valid;
}

export function assignAutomatically(task: Task, agents: TaskAgent[]): Task {
  const candidates = agents.filter((agent) => agent.enabled && agent.projectId === task.projectId);
  const candidate = candidates[0];
  if (!candidate)
    throw new Error(
      "Crie e habilite agentes neste projeto antes de atribuir tarefas automaticamente.",
    );
  // Demonstration rule; the real onboarding will select agents by role/skills.
  return { ...task, assigneeId: candidate.id };
}

export function removeExamples(workspace: TasksWorkspace): TasksWorkspace {
  const tasks = workspace.tasks.filter((task) => task.origin === "manual");
  const ids = new Set(tasks.map((task) => task.id));
  return {
    ...workspace,
    tasks: tasks.map((task) => ({
      ...task,
      dependencies: task.dependencies.filter((id) => ids.has(id)),
    })),
  };
}
