import type { Project, Ticket } from "@le-fabrique/contracts";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  authenticate,
  createProject,
  createTicket,
  listProjects,
  listTickets,
  markTicketReady,
  updateProjectBaseRevision,
} from "./control-api";
import { ProjectDefinitionPanel } from "./ProjectDefinitionPanel";
import { hasExecutableBaseRevision } from "./project-view-model";
import { SettingsPanel } from "./SettingsPanel";

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("adminToken") ?? "");
  const [authenticated, setAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState("Informe o token administrativo.");
  const [activeArea, setActiveArea] = useState<"control" | "settings">("control");
  const [projectDefinitionVersion, setProjectDefinitionVersion] = useState<number | null>(null);
  const [projectExecutionProfileReady, setProjectExecutionProfileReady] = useState(false);
  const activeProject = projects.find((project) => project.id === selectedProject);
  const projectHasExecutableBase = activeProject
    ? hasExecutableBaseRevision(activeProject.baseRef)
    : false;
  const projectCanExecute =
    projectHasExecutableBase && projectDefinitionVersion !== null && projectExecutionProfileReady;

  async function loadProjects(activeToken = token) {
    const data = await listProjects(activeToken);
    setProjects(data);
    if (!selectedProject && data[0]) setSelectedProject(data[0].id);
  }

  useEffect(() => {
    if (!authenticated || !selectedProject) return;
    listTickets(token, selectedProject)
      .then(setTickets)
      .catch(() => setMessage("Falha ao carregar tickets."));
  }, [authenticated, selectedProject, token]);

  async function login(event: FormEvent) {
    event.preventDefault();
    try {
      await authenticate(token);
      sessionStorage.setItem("adminToken", token);
      setAuthenticated(true);
      setMessage("Sessão administrativa ativa.");
      await loadProjects(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha de autenticação");
    }
  }

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const project = await createProject(token, {
        name: String(form.get("name")),
        repoUrl: String(form.get("repoUrl")),
        baseRef: String(form.get("baseRef")),
      });
      event.currentTarget.reset();
      await loadProjects();
      setSelectedProject(project.id);
      setMessage("Projeto cadastrado.");
    } catch {
      setMessage("Revise os dados do projeto.");
    }
  }

  async function addTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;
    const form = new FormData(event.currentTarget);
    try {
      await createTicket(token, selectedProject, {
        title: String(form.get("title")),
        objective: String(form.get("objective")),
        acceptanceCriteria: String(form.get("criteria"))
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      event.currentTarget.reset();
      setTickets(await listTickets(token, selectedProject));
      setMessage("Ticket cadastrado como rascunho.");
    } catch {
      setMessage("Revise os dados e os critérios do ticket.");
    }
  }

  async function setBaseRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProject) return;
    const form = new FormData(event.currentTarget);
    try {
      const updated = await updateProjectBaseRevision(
        token,
        activeProject,
        String(form.get("baseRevision")),
      );
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("Revisão-base exata configurada; tickets podem ser promovidos a READY.");
    } catch {
      setMessage("A referência do projeto mudou; recarregue antes de atualizar o SHA.");
    }
  }

  async function ready(ticket: Ticket) {
    try {
      const updated = await markTicketReady(token, ticket);
      setTickets((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("Ticket pronto e evento de outbox registrado.");
    } catch {
      setMessage("Ticket não promovido; confirme a revisão-base e recarregue o estado.");
    }
  }

  if (!authenticated)
    return (
      <main className="login-shell">
        <form className="panel login" onSubmit={login}>
          <p className="eyebrow">LE FABRIQUE</p>
          <h1>Controle da fábrica</h1>
          <label>
            Token administrativo
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              minLength={32}
              required
            />
          </label>
          <button type="submit">Entrar</button>
          <p className="message" role="status">
            {message}
          </p>
        </form>
      </main>
    );

  return (
    <main className="shell">
      <header>
        <div>
          <p className="eyebrow">LE FABRIQUE</p>
          <h1>{activeArea === "control" ? "Controle" : "Configurações"}</h1>
        </div>
        <p className="message" role="status">
          {message}
        </p>
      </header>
      <nav className="area-nav" aria-label="Áreas do painel">
        <button
          type="button"
          className={activeArea === "control" ? "active" : ""}
          onClick={() => setActiveArea("control")}
        >
          Operação
        </button>
        <button
          type="button"
          className={activeArea === "settings" ? "active" : ""}
          onClick={() => setActiveArea("settings")}
        >
          Configurações
        </button>
      </nav>
      {activeArea === "settings" ? (
        <SettingsPanel token={token} onMessage={setMessage} />
      ) : (
        <>
          <section className="columns">
            <form className="panel" onSubmit={addProject}>
              <h2>Novo projeto</h2>
              <label>
                Nome
                <input name="name" required />
              </label>
              <label>
                Repositório
                <input name="repoUrl" type="url" placeholder="https://…" required />
              </label>
              <label>
                Referência base
                <input name="baseRef" defaultValue="main" required />
              </label>
              <button type="submit">Cadastrar projeto</button>
            </form>
            <form className="panel" onSubmit={addTicket}>
              <h2>Novo ticket</h2>
              <label>
                Projeto
                <select
                  value={selectedProject}
                  onChange={(event) => setSelectedProject(event.target.value)}
                  required
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
                <input name="title" required />
              </label>
              <label>
                Objetivo
                <textarea name="objective" required />
              </label>
              <label>
                Critérios, um por linha
                <textarea name="criteria" required />
              </label>
              <button type="submit">Criar rascunho</button>
            </form>
            <form
              className="panel"
              key={activeProject ? `${activeProject.id}:${activeProject.baseRef}` : "no-project"}
              onSubmit={setBaseRevision}
            >
              <h2>Revisão-base executável</h2>
              {activeProject ? (
                <>
                  <p className="muted">
                    Referência atual: <code>{activeProject.baseRef}</code>
                  </p>
                  <label>
                    SHA exato do commit
                    <input
                      name="baseRevision"
                      pattern="[0-9a-f]{40}"
                      minLength={40}
                      maxLength={40}
                      placeholder="40 caracteres hexadecimais em minúsculas"
                      required
                    />
                  </label>
                  <button type="submit">Atualizar revisão-base</button>
                  <p className="muted">
                    {projectHasExecutableBase
                      ? "SHA válido. A definição do projeto também precisa estar configurada."
                      : "READY permanece bloqueado até configurar um SHA exato."}
                  </p>
                </>
              ) : (
                <p className="muted">Selecione um projeto.</p>
              )}
            </form>
          </section>
          <ProjectDefinitionPanel
            token={token}
            project={activeProject}
            onMessage={setMessage}
            onVersion={setProjectDefinitionVersion}
            onProfileReady={setProjectExecutionProfileReady}
          />
          <section className="panel records">
            <h2>Tickets</h2>
            {tickets.length === 0 ? (
              <p className="muted">Nenhum ticket neste projeto.</p>
            ) : (
              tickets.map((ticket) => (
                <article key={ticket.id}>
                  <div>
                    <span className={`badge badge--${ticket.status.toLowerCase()}`}>
                      {ticket.status}
                    </span>
                    <h3>{ticket.title}</h3>
                    <p>{ticket.objective}</p>
                  </div>
                  {ticket.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={!projectCanExecute}
                      title={
                        projectCanExecute
                          ? "Promover ticket"
                          : "Configure SHA-base, definição e perfil de execução aprovado antes de READY"
                      }
                      onClick={() => ready(ticket)}
                    >
                      Marcar READY
                    </button>
                  )}
                </article>
              ))
            )}
            <p className="muted">
              Jobs falhos já existentes permanecem no histórico e não são repetidos por esta tela.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
