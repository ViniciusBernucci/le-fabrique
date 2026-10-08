import type { DigitalAgent } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { getFactorySettings } from "./control-api";
import { SettingsModal } from "./SettingsModal";
import {
  assignAutomatically,
  demoOnboarding,
  phases,
  priorities,
  removeExamples,
  stages,
  TASKS_STORAGE_KEY,
  type Task,
  type TaskProject,
  type TasksWorkspace,
  validateTask,
  workspaceSchema,
} from "./tasks-model";
import "./tasks.css";

function loadDemo(): { workspace: TasksWorkspace; error: string } {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return { workspace: demoOnboarding(), error: "" };
    return { workspace: workspaceSchema.parse(JSON.parse(raw)), error: "" };
  } catch {
    return {
      workspace: { schemaVersion: 1, projects: [], agents: [], tasks: [] },
      error:
        "Não foi possível ler os dados locais. Eles foram preservados. Libere o armazenamento ou recupere o conteúdo antes de continuar.",
    };
  }
}

export function TasksPanel({
  projects: registeredProjects = [],
  token,
}: {
  projects?: TaskProject[];
  token?: string;
}) {
  const [initial] = useState(loadDemo);
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initial.error));
  const [message, setMessage] = useState(initial.error);
  const [systemAgents, setSystemAgents] = useState<DigitalAgent[]>([]);
  const [agentError, setAgentError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const [phase, setPhase] = useState("");
  const [stage, setStage] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [draft, setDraft] = useState<Task | null>(null);
  const [criteriaText, setCriteriaText] = useState("");
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<"remove" | "restore" | null>(null);
  const [agentsVersion, setAgentsVersion] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit refresh reloads the registered project team.
  useEffect(() => {
    if (!token) return;
    let active = true;
    setSystemAgents([]);
    getFactorySettings(token)
      .then((settings) => {
        if (active) {
          setSystemAgents(settings.configuration.digitalAgents ?? []);
          setAgentError("");
        }
      })
      .catch(() => {
        if (active)
          setAgentError(
            "Não foi possível carregar os agentes cadastrados. Tente atualizar a equipe.",
          );
      });
    return () => {
      active = false;
    };
  }, [token, agentsVersion]);
  const projects = [...workspace.projects, ...registeredProjects];
  const agents = [...workspace.agents, ...systemAgents];
  const eligible = agents.filter((agent) => agent.enabled && agent.projectId === draft?.projectId);
  const visible = workspace.tasks.filter(
    (task) =>
      (!projectId || task.projectId === projectId) &&
      (!assignee ||
        (assignee === "unassigned" ? !task.assigneeId : task.assigneeId === assignee)) &&
      (!priority || task.priority === priority) &&
      (!phase || task.phase === phase) &&
      (!stage || task.stage === stage) &&
      `${task.code} ${task.title} ${task.specification}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const finished = visible.filter((task) => task.stage === "Concluído").length;
  function commit(next: TasksWorkspace, description: string) {
    if (storageBlocked) {
      setMessage(
        "Dados locais não foram substituídos. Resolva o erro de armazenamento antes de salvar.",
      );
      return false;
    }
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(workspaceSchema.parse(next)));
      setWorkspace(next);
      setMessage(description);
      return true;
    } catch {
      setMessage(
        "Não foi possível salvar no navegador. As alterações não foram aplicadas; verifique o armazenamento disponível.",
      );
      return false;
    }
  }
  function open(task: Task) {
    setDraft({ ...task, dependencies: [...task.dependencies] });
    setCriteriaText(task.criteria.join("\n"));
    setError("");
  }
  function create() {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    open({
      id,
      code: `TASK-${id.slice(0, 8).toUpperCase()}`,
      projectId: projectId || projects[0]?.id || "",
      title: "",
      specification: "",
      criteria: [],
      assigneeId: null,
      stage: "Backlog",
      phase: "Planejamento",
      priority: "Normal",
      dueDate: "",
      dependencies: [],
      origin: "manual",
      history: [{ at: now, description: "Tarefa criada manualmente na demonstração." }],
    });
  }
  function save() {
    if (!draft) return;
    try {
      const previous = workspace.tasks.find((task) => task.id === draft.id);
      const validated = validateTask(
        {
          ...draft,
          criteria: criteriaText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        },
        workspace.tasks,
        projects,
        agents,
      );
      if (
        previous &&
        previous.projectId !== validated.projectId &&
        workspace.tasks.some((task) => task.dependencies.includes(validated.id))
      )
        throw new Error("Remova as referências a esta tarefa antes de trocar o projeto.");
      const next = {
        ...validated,
        history: previous
          ? [
              ...previous.history,
              {
                at: new Date().toISOString(),
                description: `Edição manual: ${validated.stage}; responsável: ${agents.find((agent) => agent.id === validated.assigneeId)?.name ?? "não atribuído"}.`,
              },
            ]
          : validated.history,
      };
      if (
        commit(
          {
            ...workspace,
            tasks: previous
              ? workspace.tasks.map((task) => (task.id === next.id ? next : task))
              : [...workspace.tasks, next],
          },
          "Tarefa salva na demonstração local.",
        )
      )
        setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revise a tarefa.");
    }
  }
  function changeStage(task: Task, next: Task["stage"]) {
    commit(
      {
        ...workspace,
        tasks: workspace.tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                stage: next,
                history: [
                  ...item.history,
                  {
                    at: new Date().toISOString(),
                    description: `Etapa simulada alterada de ${item.stage} para ${next}.`,
                  },
                ],
              }
            : item,
        ),
      },
      "Etapa atualizada na demonstração.",
    );
  }
  function confirm() {
    if (confirmAction === "remove") {
      if (
        commit(
          removeExamples(workspace),
          "Tickets de exemplo removidos; tarefas manuais e suas equipes foram preservadas.",
        )
      )
        setConfirmAction(null);
    } else {
      const sample = demoOnboarding();
      const clean = removeExamples(workspace);
      const next = {
        ...clean,
        projects: [
          ...clean.projects.filter(
            (item) => !sample.projects.some((project) => project.id === item.id),
          ),
          ...sample.projects,
        ],
        agents: [
          ...clean.agents.filter((item) => !sample.agents.some((agent) => agent.id === item.id)),
          ...sample.agents,
        ],
        tasks: [...clean.tasks, ...sample.tasks],
      };
      if (
        commit(
          next,
          "Onboarding simulado: projeto e agentes criados antes da distribuição dos tickets.",
        )
      )
        setConfirmAction(null);
    }
  }
  function card(task: Task) {
    const owner = agents.find((agent) => agent.id === task.assigneeId);
    return (
      <article className="task-card" key={task.id} data-task-stage={task.stage}>
        <div className="task-card-meta">
          <span>{task.code}</span>
          <span className={`task-priority priority-${priorities.indexOf(task.priority)}`}>
            {task.priority}
          </span>
        </div>
        <button type="button" className="task-title" onClick={() => open(task)}>
          {task.title}
        </button>
        <p>
          {projects.find((project) => project.id === task.projectId)?.name ??
            "Projeto indisponível"}
        </p>
        <span className="task-phase">{task.phase}</span>
        <span className="task-stage" data-task-stage={task.stage}>
          {task.stage}
        </span>
        <div className="task-owner">
          <span className="task-avatar" aria-hidden="true">
            {owner?.name.slice(0, 2).toUpperCase() ?? "?"}
          </span>
          <span>
            {owner
              ? `${owner.name}${owner.enabled ? "" : " · desabilitado"}`
              : task.assigneeId
                ? "Agente indisponível"
                : "Sem responsável"}
          </span>
        </div>
        <div className="task-card-footer">
          <span>
            {task.dueDate ? `Prazo: ${task.dueDate.split("-").reverse().join("/")}` : "Sem prazo"}
          </span>
          <span>{task.dependencies.length} dependência(s)</span>
        </div>
        <label className="task-stage-label">
          Etapa de {task.code}
          <select
            value={task.stage}
            onChange={(event) => changeStage(task, event.target.value as Task["stage"])}
            disabled={storageBlocked}
          >
            {stages.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </article>
    );
  }
  return (
    <main className="tasks-shell">
      <header className="tasks-heading">
        <div>
          <p className="eyebrow">Workspace de desenvolvimento</p>
          <h1>Tarefas</h1>
          <p>Do planejamento à entrega, com a equipe no mesmo lugar.</p>
        </div>
        <button type="button" onClick={create} disabled={!projects.length || storageBlocked}>
          + Nova tarefa
        </button>
      </header>
      <aside className="tasks-demo">
        <strong>Demonstração · dados mockados</strong>
        <p>
          Tickets salvos apenas neste navegador. As etapas são simuladas; não executam agentes. A
          integração com o banco compartilhado e o onboarding real está pendente.
        </p>
        <div>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setConfirmAction("restore")}
            disabled={storageBlocked}
          >
            Simular onboarding
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setConfirmAction("remove")}
            disabled={storageBlocked}
          >
            Remover tickets de exemplo
          </button>
        </div>
      </aside>
      {message && (
        <p role="status" className="tasks-message">
          {message}
        </p>
      )}
      {storageBlocked && (
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            const loaded = loadDemo();
            setWorkspace(loaded.workspace);
            setStorageBlocked(Boolean(loaded.error));
            setMessage(loaded.error || "Armazenamento recuperado.");
          }}
        >
          Tentar ler novamente
        </button>
      )}
      {token && (
        <div className="task-team-status">
          <p>
            {agentError ||
              `${systemAgents.length} agente(s) cadastrado(s) disponíveis para consulta.`}
          </p>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setAgentsVersion((version) => version + 1)}
          >
            Atualizar equipe
          </button>
        </div>
      )}
      <section className="tasks-metrics" aria-label="Resumo das tarefas filtradas">
        {[
          ["Tarefas", visible.length],
          ["Em andamento", visible.filter((task) => task.stage === "Em andamento").length],
          ["Bloqueadas", visible.filter((task) => task.stage === "Bloqueado").length],
          ["Concluídas", `${finished}/${visible.length}`],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="tasks-toolbar" aria-label="Filtros de tarefas">
        <label>
          Buscar
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Título, código ou especificação"
          />
        </label>
        <label>
          Projeto
          <select
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setAssignee("");
            }}
          >
            <option value="">Todos os projetos</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsável
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Todos os responsáveis</option>
            <option value="unassigned">Sem responsável</option>
            {agents
              .filter((agent) => !projectId || agent.projectId === projectId)
              .map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Prioridade
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">Todas</option>
            {priorities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Fase do projeto
          <select value={phase} onChange={(event) => setPhase(event.target.value)}>
            <option value="">Todas</option>
            {phases.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Etapa do ticket
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">Todas</option>
            {stages.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </section>
      <div className="tasks-view">
        <span>
          {visible.length} tarefa(s) ·{" "}
          {visible.length ? Math.round((finished / visible.length) * 100) : 0}% concluído
        </span>
        <div>
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>
            Quadro
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
            Lista
          </button>
        </div>
      </div>
      {!visible.length && (
        <p className="tasks-empty">
          Nenhuma tarefa encontrada. Ajuste os filtros ou crie uma nova tarefa.
        </p>
      )}
      {view === "board" ? (
        <section className="tasks-board" aria-label="Quadro de tarefas">
          {stages.map((value) => (
            <section className="tasks-column" key={value} data-task-stage={value}>
              <h2>
                <i aria-hidden="true" />
                {value}
                <span>{visible.filter((task) => task.stage === value).length}</span>
              </h2>
              {visible.filter((task) => task.stage === value).map(card)}
              {!visible.some((task) => task.stage === value) && (
                <p className="task-column-empty">Nenhuma tarefa</p>
              )}
            </section>
          ))}
        </section>
      ) : (
        <section className="tasks-list" aria-label="Lista de tarefas">
          {visible.map(card)}
        </section>
      )}
      {draft && (
        <SettingsModal
          title={`${workspace.tasks.some((task) => task.id === draft.id) ? "Editar" : "Nova"} tarefa · ${draft.code}`}
          saving={false}
          onClose={() => setDraft(null)}
          onSave={save}
        >
          <p className="tasks-editor-note">
            Demonstração local. Alterações de etapa não representam execução ou aceite real.
          </p>
          <label>
            Projeto
            <select
              required
              value={draft.projectId}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  projectId: event.target.value,
                  assigneeId: null,
                  dependencies: [],
                })
              }
            >
              <option value="">Selecione</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label>
            Especificação
            <textarea
              required
              maxLength={4000}
              rows={5}
              value={draft.specification}
              onChange={(event) => setDraft({ ...draft, specification: event.target.value })}
            />
          </label>
          <label>
            Critérios de aceite, um por linha
            <textarea
              required
              rows={4}
              value={criteriaText}
              onChange={(event) => setCriteriaText(event.target.value)}
            />
          </label>
          <label>
            Responsável
            <select
              value={draft.assigneeId ?? ""}
              onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value || null })}
            >
              <option value="">Sem responsável</option>
              {eligible.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
              {draft.assigneeId && !eligible.some((agent) => agent.id === draft.assigneeId) && (
                <option value={draft.assigneeId}>Agente indisponível · selecione outro</option>
              )}
            </select>
          </label>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              try {
                setDraft(assignAutomatically(draft, agents));
                setError("");
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Falha na atribuição");
              }
            }}
          >
            Atribuir automaticamente (demonstração)
          </button>
          {!eligible.length && (
            <p>
              Crie agentes habilitados neste projeto antes da atribuição automática. O rascunho pode
              ficar sem responsável.
            </p>
          )}
          <div className="tasks-editor-grid">
            <label>
              Prioridade
              <select
                value={draft.priority}
                onChange={(event) =>
                  setDraft({ ...draft, priority: event.target.value as Task["priority"] })
                }
              >
                {priorities.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Prazo
              <input
                type="date"
                value={draft.dueDate}
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
              />
            </label>
            <label>
              Fase do projeto
              <select
                value={draft.phase}
                onChange={(event) =>
                  setDraft({ ...draft, phase: event.target.value as Task["phase"] })
                }
              >
                {phases.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Etapa do ticket
              <select
                value={draft.stage}
                onChange={(event) =>
                  setDraft({ ...draft, stage: event.target.value as Task["stage"] })
                }
              >
                {stages.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Depende de (Ctrl/Cmd para selecionar várias)
            <select
              multiple
              value={draft.dependencies}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  dependencies: Array.from(event.target.selectedOptions, (option) => option.value),
                })
              }
            >
              {workspace.tasks
                .filter((task) => task.projectId === draft.projectId && task.id !== draft.id)
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.code} · {task.title}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setDraft({ ...draft, dependencies: [] })}
          >
            Limpar dependências
          </button>
          {error && <p role="alert">{error}</p>}
          <details>
            <summary>Histórico da tarefa ({draft.history.length})</summary>
            <ol className="tasks-history">
              {draft.history.map((entry) => (
                <li key={`${entry.at}-${entry.description}`}>
                  <time dateTime={entry.at}>{new Date(entry.at).toLocaleString("pt-BR")}</time>
                  <p>{entry.description}</p>
                </li>
              ))}
            </ol>
          </details>
        </SettingsModal>
      )}
      {confirmAction && (
        <SettingsModal
          title={confirmAction === "remove" ? "Remover tickets de exemplo?" : "Simular onboarding?"}
          saving={false}
          onClose={() => setConfirmAction(null)}
          onSave={confirm}
        >
          <p>
            {confirmAction === "remove"
              ? "Somente os tickets de exemplo serão removidos, incluindo edições feitas neles. Tarefas criadas manualmente serão preservadas; vínculos com exemplos removidos serão limpos."
              : "Os tickets de exemplo serão recriados e suas edições substituídas. Tarefas manuais serão preservadas. A simulação cria projeto e equipe antes de distribuir tickets."}
          </p>
        </SettingsModal>
      )}
    </main>
  );
}
