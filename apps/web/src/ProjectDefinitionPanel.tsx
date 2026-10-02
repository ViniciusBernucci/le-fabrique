import type { Project, ProjectCheck } from "@le-fabrique/contracts";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getProjectDefinition, putProjectDefinition } from "./control-api";
import { parseCheckArguments, parsePathLines } from "./project-definition-view-model";

type EditableCheck = ProjectCheck & { id: string; argsText: string };

const emptyCheck = (): EditableCheck => ({
  id: crypto.randomUUID(),
  name: "",
  command: "",
  args: [],
  argsText: "[]",
});

export function ProjectDefinitionPanel({
  token,
  project,
  onMessage,
  onVersion,
}: {
  token: string;
  project: Project | undefined;
  onMessage: (message: string) => void;
  onVersion: (version: number | null) => void;
}) {
  const [version, setVersion] = useState(0);
  const [summary, setSummary] = useState("");
  const [externalStack, setExternalStack] = useState("");
  const [instructions, setInstructions] = useState("");
  const [allowedPaths, setAllowedPaths] = useState("");
  const [forbiddenPaths, setForbiddenPaths] = useState("");
  const [checks, setChecks] = useState<EditableCheck[]>([emptyCheck()]);

  useEffect(() => {
    onVersion(null);
    if (!project) return;
    getProjectDefinition(token, project.id)
      .then((definition) => {
        setVersion(definition?.version ?? 0);
        setSummary(definition?.summary ?? "");
        setExternalStack(definition?.externalStack ?? "");
        setInstructions(definition?.instructions ?? "");
        setAllowedPaths(definition?.allowedPaths.join("\n") ?? "");
        setForbiddenPaths(definition?.forbiddenPaths.join("\n") ?? "");
        setChecks(
          definition?.checks.map((check) => ({
            ...check,
            id: crypto.randomUUID(),
            argsText: JSON.stringify(check.args),
          })) ?? [emptyCheck()],
        );
        onVersion(definition?.version ?? null);
      })
      .catch(() => onMessage("Falha ao carregar a definição do projeto."));
  }, [onMessage, onVersion, project, token]);

  function updateCheck(index: number, patch: Partial<EditableCheck>) {
    setChecks((current) =>
      current.map((check, checkIndex) => (checkIndex === index ? { ...check, ...patch } : check)),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    try {
      const saved = await putProjectDefinition(token, project.id, version, {
        summary,
        externalStack,
        instructions,
        allowedPaths: parsePathLines(allowedPaths),
        forbiddenPaths: parsePathLines(forbiddenPaths),
        checks: checks.map(({ name, command, argsText }) => ({
          name,
          command,
          args: parseCheckArguments(argsText),
        })),
      });
      setVersion(saved.version);
      onVersion(saved.version);
      onMessage(`Definição do projeto salva na versão ${saved.version}.`);
    } catch {
      onMessage("Definição inválida ou alterada por outra sessão; revise e recarregue.");
    }
  }

  return (
    <form className="panel project-definition" onSubmit={save}>
      <div className="section-heading">
        <div>
          <h2>Definição do projeto</h2>
          <span className="badge">v{version || "nova"}</span>
        </div>
        <p>Contexto operacional configurado no software, sem embutir um projeto no código.</p>
      </div>
      {!project ? (
        <p className="muted">Selecione um projeto.</p>
      ) : (
        <>
          <label>
            Descrição e objetivo
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              required
            />
          </label>
          <label>
            Stack do projeto externo
            <textarea
              value={externalStack}
              onChange={(event) => setExternalStack(event.target.value)}
              required
            />
          </label>
          <label>
            Instruções e restrições
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              required
            />
          </label>
          <div className="columns">
            <label>
              Caminhos permitidos, um por linha
              <textarea
                value={allowedPaths}
                onChange={(event) => setAllowedPaths(event.target.value)}
                placeholder="src\ntests"
                required
              />
            </label>
            <label>
              Caminhos proibidos, um por linha
              <textarea
                value={forbiddenPaths}
                onChange={(event) => setForbiddenPaths(event.target.value)}
                placeholder="secrets\ninfra/production"
              />
            </label>
          </div>
          <h3>Checks de baseline e validação</h3>
          <p className="muted">
            Executável e argumentos são armazenados separadamente; nenhum shell é usado.
          </p>
          {checks.map((check, index) => (
            <div className="check-row" key={check.id}>
              <label>
                Nome
                <input
                  value={check.name}
                  onChange={(event) => updateCheck(index, { name: event.target.value })}
                  required
                />
              </label>
              <label>
                Executável
                <input
                  value={check.command}
                  onChange={(event) => updateCheck(index, { command: event.target.value })}
                  placeholder="/usr/bin/npm"
                  required
                />
              </label>
              <label>
                Argumentos JSON
                <input
                  value={check.argsText}
                  onChange={(event) => updateCheck(index, { argsText: event.target.value })}
                  placeholder='["test"]'
                  required
                />
              </label>
              {checks.length > 1 && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() =>
                    setChecks((current) => current.filter((_, item) => item !== index))
                  }
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          {checks.length < 20 && (
            <button
              className="secondary-action"
              type="button"
              onClick={() => setChecks((current) => [...current, emptyCheck()])}
            >
              Adicionar check
            </button>
          )}
          <button type="submit">Salvar definição</button>
        </>
      )}
    </form>
  );
}
