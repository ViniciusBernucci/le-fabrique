import type {
  DigitalAgent,
  FactoryConfiguration,
  Project,
  ProjectSkill,
} from "@le-fabrique/contracts";
import { factoryConfigurationSchema } from "@le-fabrique/contracts";
import type { KeyboardEvent, ReactNode } from "react";
import { useId, useState } from "react";
import { SettingsModal } from "./SettingsModal";
import { removeProjectSkill, upsertProjectSkill } from "./teams-view-model";

type Props = {
  configuration: FactoryConfiguration;
  projects: Project[];
  activeProjectId?: string;
  saving: boolean;
  onSave: (configuration: FactoryConfiguration) => Promise<boolean>;
  children?: ReactNode;
};
export function TeamsPanel({
  configuration,
  projects,
  activeProjectId,
  saving,
  onSave,
  children,
}: Props) {
  const [tab, setTab] = useState<"agents" | "skills">("agents");
  const [projectId, setProjectId] = useState(activeProjectId ?? "");
  const [agent, setAgent] = useState<DigitalAgent | null>(null);
  const [skill, setSkill] = useState<ProjectSkill | null>(null);
  const [error, setError] = useState("");
  const prefix = useId();
  const selectedProject =
    projects.find((project) => project.id === projectId) ??
    projects.find((project) => project.id === activeProjectId) ??
    projects[0];
  const agents = configuration.digitalAgents ?? [];
  const skills = configuration.projectSkills ?? [];
  const projectSkills = skills.filter((item) => item.projectId === selectedProject?.id);
  function selectTab(next: "agents" | "skills") {
    setTab(next);
    setError("");
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, current: "agents" | "skills") {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "agents"
        : event.key === "End"
          ? "skills"
          : current === "agents"
            ? "skills"
            : "agents";
    selectTab(next);
    document.getElementById(`${prefix}-${next}-tab`)?.focus();
  }
  async function persist(next: FactoryConfiguration): Promise<boolean> {
    setError("");
    const parsed = factoryConfigurationSchema.safeParse(next);
    if (!parsed.success) {
      setError("Revise os campos, a conta/modelo e as skills vinculadas ao projeto.");
      return false;
    }
    const saved = await onSave(parsed.data);
    if (!saved)
      setError(
        "Não foi possível salvar. Recarregue as configurações se outra alteração foi salva.",
      );
    return saved;
  }
  async function saveAgent() {
    if (!agent) return;
    const next = agents.some((item) => item.id === agent.id)
      ? agents.map((item) => (item.id === agent.id ? agent : item))
      : [...agents, agent];
    if (await persist({ ...configuration, digitalAgents: next })) setAgent(null);
  }
  async function saveSkill() {
    if (skill && (await persist(upsertProjectSkill(configuration, skill)))) setSkill(null);
  }
  function addAgent() {
    setError("");
    setAgent({
      id: crypto.randomUUID(),
      name: "",
      description: "",
      instructions: "",
      projectId: selectedProject?.id ?? null,
      installationId: null,
      model: null,
      skillIds: [],
      enabled: true,
    });
  }
  function addSkill() {
    if (!selectedProject) return;
    setError("");
    setSkill({
      id: crypto.randomUUID(),
      projectId: selectedProject.id,
      name: "",
      description: "",
      instructions: "",
    });
  }
  function editAgent(value: DigitalAgent) {
    setError("");
    setAgent(structuredClone(value));
  }
  function editSkill(value: ProjectSkill) {
    setError("");
    setSkill(structuredClone(value));
  }
  return (
    <section className="panel settings-section teams-panel">
      <div className="section-heading">
        <div>
          <p className="section-index">02</p>
          <h2>Equipes</h2>
        </div>
        <p>Organize seus agentes e registre as skills de cada projeto.</p>
      </div>
      <div className="settings-tabs team-tabs" role="tablist" aria-label="Organização de equipes">
        {(
          [
            ["agents", "Agentes"],
            ["skills", "Skills"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${prefix}-${id}-tab`}
            aria-selected={tab === id}
            aria-controls={`${prefix}-${id}-panel`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)}
            onKeyDown={(event) => tabKey(event, id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${prefix}-agents-panel`}
        aria-labelledby={`${prefix}-agents-tab`}
        hidden={tab !== "agents"}
      >
        <div className="team-list-heading">
          <p>{agents.length} agente(s) cadastrado(s)</p>
          <button type="button" onClick={addAgent} disabled={saving}>
            + Adicionar agente
          </button>
        </div>
        <div className="account-list">
          {agents.map((item) => (
            <button
              type="button"
              className="account-list-item"
              key={item.id}
              aria-label={`Editar agente ${item.name}`}
              onClick={() => editAgent(item)}
            >
              <span className="provider-mark">{item.name.slice(0, 1).toUpperCase()}</span>
              <span className="account-list-name">
                <strong>{item.name}</strong>
                <span className="account-list-detail">{item.description || "Sem descrição"}</span>
                <span className="account-list-detail">
                  {projects.find((project) => project.id === item.projectId)?.name ??
                    "Todos os projetos"}{" "}
                  · {item.skillIds.length} skill(s)
                </span>
              </span>
              <span className="status">{item.enabled ? "Cadastro ativo" : "Inativo"}</span>
              <span className="account-list-edit">Configurar →</span>
            </button>
          ))}
        </div>
        {agents.length === 0 && (
          <p className="muted team-empty">
            Nenhum agente cadastrado. Adicione os agentes de que sua equipe precisa.
          </p>
        )}
        <details className="team-execution-roles">
          <summary>Funções de execução da fábrica</summary>
          {children}
        </details>
      </div>
      <div
        role="tabpanel"
        id={`${prefix}-skills-panel`}
        aria-labelledby={`${prefix}-skills-tab`}
        hidden={tab !== "skills"}
      >
        <div className="team-list-heading">
          <label>
            Projeto das skills
            <select
              value={selectedProject?.id ?? ""}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="" disabled>
                Selecione um projeto
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addSkill} disabled={saving || !selectedProject}>
            + Registrar skill
          </button>
        </div>
        {!selectedProject ? (
          <p className="muted team-empty">
            Cadastre um projeto em Projetos para registrar suas skills.
          </p>
        ) : (
          <>
            <p className="muted">
              {projectSkills.length} skill(s) de {selectedProject.name}
            </p>
            <div className="account-list">
              {projectSkills.map((item) => (
                <button
                  type="button"
                  className="account-list-item"
                  key={item.id}
                  aria-label={`Editar skill ${item.name}`}
                  onClick={() => editSkill(item)}
                >
                  <span className="provider-mark">S</span>
                  <span className="account-list-name">
                    <strong>{item.name}</strong>
                    <span className="account-list-detail">
                      {item.description || "Sem descrição"}
                    </span>
                  </span>
                  <span className="account-list-edit">Editar →</span>
                </button>
              ))}
            </div>
            {projectSkills.length === 0 && (
              <p className="muted team-empty">Nenhuma skill registrada neste projeto.</p>
            )}
          </>
        )}
      </div>
      {error && !agent && !skill && <p role="alert">{error}</p>}
      {agent && (
        <SettingsModal
          title={
            agents.some((item) => item.id === agent.id)
              ? `Editar agente ${agent.name}`
              : "Novo agente"
          }
          saving={saving}
          onClose={() => {
            setAgent(null);
            setError("");
          }}
          onSave={() => void saveAgent()}
        >
          <label>
            Nome do agente
            <input
              autoComplete="off"
              value={agent.name}
              onChange={(event) => setAgent({ ...agent, name: event.target.value })}
              required
              maxLength={100}
            />
          </label>
          <label>
            Descrição do agente
            <textarea
              value={agent.description}
              onChange={(event) => setAgent({ ...agent, description: event.target.value })}
              maxLength={500}
            />
          </label>
          <label>
            Projeto do agente
            <select
              value={agent.projectId ?? ""}
              onChange={(event) => {
                const nextId = event.target.value || null;
                setAgent({
                  ...agent,
                  projectId: nextId,
                  skillIds: agent.skillIds.filter((id) =>
                    skills.some((item) => item.id === id && item.projectId === nextId),
                  ),
                });
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
            Conta e modelo do agente
            <select
              value={
                agent.installationId && agent.model ? `${agent.installationId}::${agent.model}` : ""
              }
              onChange={(event) => {
                const [installationId, ...modelParts] = event.target.value.split("::");
                setAgent({
                  ...agent,
                  installationId: installationId || null,
                  model: modelParts.join("::") || null,
                });
              }}
            >
              <option value="">Sem conta e modelo</option>
              {configuration.installations
                .filter((item) => item.enabled)
                .flatMap((item) =>
                  item.models.map((model) => (
                    <option key={`${item.id}::${model}`} value={`${item.id}::${model}`}>
                      {item.label} · {model}
                    </option>
                  )),
                )}
            </select>
          </label>
          <label>
            Instruções do agente
            <textarea
              value={agent.instructions}
              onChange={(event) => setAgent({ ...agent, instructions: event.target.value })}
              maxLength={16_000}
            />
          </label>
          <fieldset className="team-skill-picker">
            <legend>Skills do projeto</legend>
            {skills
              .filter((item) => item.projectId === agent.projectId)
              .map((item) => (
                <label className="switch-row" key={item.id}>
                  <input
                    type="checkbox"
                    checked={agent.skillIds.includes(item.id)}
                    onChange={(event) =>
                      setAgent({
                        ...agent,
                        skillIds: event.target.checked
                          ? [...agent.skillIds, item.id]
                          : agent.skillIds.filter((id) => id !== item.id),
                      })
                    }
                  />
                  {item.name}
                </label>
              ))}
            {!skills.some((item) => item.projectId === agent.projectId) && (
              <p className="muted">Registre skills na aba Skills para associá-las a este agente.</p>
            )}
          </fieldset>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={agent.enabled}
              onChange={(event) => setAgent({ ...agent, enabled: event.target.checked })}
            />
            Cadastro ativo
          </label>
          {error && <p role="alert">{error}</p>}
          {agents.some((item) => item.id === agent.id) && (
            <button
              type="button"
              className="remove-action"
              disabled={saving}
              onClick={() =>
                void persist({
                  ...configuration,
                  digitalAgents: agents.filter((item) => item.id !== agent.id),
                }).then((saved) => {
                  if (saved) setAgent(null);
                })
              }
            >
              Excluir agente
            </button>
          )}
        </SettingsModal>
      )}
      {skill && (
        <SettingsModal
          title={
            skills.some((item) => item.id === skill.id)
              ? `Editar skill ${skill.name}`
              : "Registrar skill"
          }
          saving={saving}
          onClose={() => {
            setSkill(null);
            setError("");
          }}
          onSave={() => void saveSkill()}
        >
          <label>
            Projeto da skill
            <select
              value={skill.projectId}
              onChange={(event) => setSkill({ ...skill, projectId: event.target.value })}
              required
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nome da skill
            <input
              autoComplete="off"
              value={skill.name}
              onChange={(event) => setSkill({ ...skill, name: event.target.value })}
              required
              maxLength={100}
            />
          </label>
          <label>
            Descrição da skill
            <textarea
              value={skill.description}
              onChange={(event) => setSkill({ ...skill, description: event.target.value })}
              maxLength={500}
            />
          </label>
          <label>
            Instruções da skill
            <textarea
              value={skill.instructions}
              onChange={(event) => setSkill({ ...skill, instructions: event.target.value })}
              required
              maxLength={64_000}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          {skills.some((item) => item.id === skill.id) && (
            <button
              type="button"
              className="remove-action"
              disabled={saving}
              onClick={() =>
                void persist(removeProjectSkill(configuration, skill.id)).then((saved) => {
                  if (saved) setSkill(null);
                })
              }
            >
              Excluir skill
            </button>
          )}
        </SettingsModal>
      )}
    </section>
  );
}
