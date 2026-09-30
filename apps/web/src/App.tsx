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
} from "./control-api";

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("adminToken") ?? "");
  const [authenticated, setAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState("Informe o token administrativo.");

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

  async function ready(ticket: Ticket) {
    try {
      const updated = await markTicketReady(token, ticket);
      setTickets((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("Ticket pronto e evento de outbox registrado.");
    } catch {
      setMessage("O ticket mudou; recarregue antes de tentar novamente.");
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
          <h1>Controle</h1>
        </div>
        <p className="message" role="status">
          {message}
        </p>
      </header>
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
      </section>
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
                <button type="button" onClick={() => ready(ticket)}>
                  Marcar READY
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
