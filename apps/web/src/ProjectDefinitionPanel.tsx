import type { Project, ProjectCheck, ProjectExecutionProfile } from "@le-fabrique/contracts";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getProjectDefinition, putProjectDefinition } from "./control-api";
import {
  formatContextSourceLines,
  parseCheckArguments,
  parseContextSourceLines,
  parsePathLines,
} from "./project-definition-view-model";

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
  onProfileReady,
}: {
  token: string;
  project: Project | undefined;
  onMessage: (message: string) => void;
  onVersion: (version: number | null) => void;
  onProfileReady: (ready: boolean) => void;
}) {
  const [version, setVersion] = useState(0);
  const [summary, setSummary] = useState("");
  const [externalStack, setExternalStack] = useState("");
  const [instructions, setInstructions] = useState("");
  const [allowedPaths, setAllowedPaths] = useState("");
  const [forbiddenPaths, setForbiddenPaths] = useState("");
  const [checks, setChecks] = useState<EditableCheck[]>([emptyCheck()]);
  const [contextSources, setContextSources] = useState("");
  const [docFiles, setDocFiles] = useState("");
  const [docReport, setDocReport] = useState("");
  const [docSections, setDocSections] = useState(
    "Objetivo e critérios de aceite\nFuncionamento\nVerificação\nRiscos e limitações\nRollback",
  );
  const [approvedCheckIds, setApprovedCheckIds] = useState<string[]>([]);

  useEffect(() => {
    onVersion(null);
    onProfileReady(false);
    if (!project) return;
    getProjectDefinition(token, project.id)
      .then((definition) => {
        setVersion(definition?.version ?? 0);
        setSummary(definition?.summary ?? "");
        setExternalStack(definition?.externalStack ?? "");
        setInstructions(definition?.instructions ?? "");
        setAllowedPaths(definition?.allowedPaths.join("\n") ?? "");
        setForbiddenPaths(definition?.forbiddenPaths.join("\n") ?? "");
        const loadedChecks = definition?.checks.map((check) => ({
          ...check,
          id: crypto.randomUUID(),
          argsText: JSON.stringify(check.args),
        })) ?? [emptyCheck()];
        setChecks(loadedChecks);
        const profileSources = definition?.executionProfile?.contextSources ?? [];
        const profileChecks = definition?.executionProfile?.approvedChecks ?? [];
        setContextSources(formatContextSourceLines(profileSources));
        const documentation = definition?.executionProfile?.documentation;
        setDocFiles(documentation?.requiredFiles.join("\n") ?? "");
        setDocReport(documentation?.reportPath ?? "");
        if (documentation) setDocSections(documentation.requiredSections.join("\n"));
        const matchingApprovedIds = loadedChecks
          .filter((check) =>
            profileChecks.some(
              (approved) =>
                approved.name === check.name &&
                approved.command === check.command &&
                JSON.stringify(approved.args) === JSON.stringify(check.args),
            ),
          )
          .map((check) => check.id);
        setApprovedCheckIds(matchingApprovedIds);
        onProfileReady(
          profileSources.length > 0 && matchingApprovedIds.length > 0 && Boolean(documentation),
        );
        onVersion(definition?.version ?? null);
      })
      .catch(() => onMessage("Falha ao carregar a definição do projeto."));
  }, [onMessage, onProfileReady, onVersion, project, token]);

  function updateCheck(index: number, patch: Partial<EditableCheck>) {
    const current = checks[index];
    if (
      current &&
      (patch.name !== undefined || patch.command !== undefined || patch.argsText !== undefined)
    ) {
      setApprovedCheckIds((ids) => ids.filter((id) => id !== current.id));
      onProfileReady(false);
    }
    setChecks((current) =>
      current.map((check, checkIndex) => (checkIndex === index ? { ...check, ...patch } : check)),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    try {
      const savedChecks = checks.map(({ name, command, argsText }) => ({
        name,
        command,
        args: parseCheckArguments(argsText),
      }));
      const approvedChecks = checks
        .filter((check) => approvedCheckIds.includes(check.id))
        .map(({ name, command, argsText }) => ({
          name,
          command,
          args: parseCheckArguments(argsText),
        }));
      const parsedContextSources = parseContextSourceLines(contextSources);
      const executionProfile: ProjectExecutionProfile | null =
        approvedChecks.length > 0 && parsedContextSources.length > 0
          ? {
              contextSources: parsedContextSources,
              approvedChecks,
              ...(docFiles.trim() && docReport.trim() && docSections.trim()
                ? {
                    documentation: {
                      requiredFiles: parsePathLines(docFiles),
                      reportPath: docReport.trim(),
                      requiredSections: docSections
                        .split("\n")
                        .map((section) => section.trim())
                        .filter(Boolean),
                    },
                  }
                : {}),
            }
          : null;
      const saved = await putProjectDefinition(token, project.id, version, {
        summary,
        externalStack,
        instructions,
        allowedPaths: parsePathLines(allowedPaths),
        forbiddenPaths: parsePathLines(forbiddenPaths),
        checks: savedChecks,
        executionProfile,
      });
      setVersion(saved.version);
      onVersion(saved.version);
      onProfileReady(
        Boolean(
          saved.executionProfile?.contextSources.length &&
            saved.executionProfile.approvedChecks.length &&
            saved.executionProfile.documentation,
        ),
      );
      onMessage(`Definição do projeto salva na versão ${saved.version}.`);
    } catch {
      onMessage("Definição inválida ou alterada por outra sessão; revise e recarregue.");
    }
  }

  function toggleApprovedCheck(check: EditableCheck, approved: boolean) {
    setApprovedCheckIds((ids) =>
      approved ? [...ids, check.id] : ids.filter((id) => id !== check.id),
    );
    onProfileReady(false);
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
            Executável e argumentos são armazenados separadamente; nenhum shell é usado. Alterar
            nome, executável ou argv remove a aprovação anterior.
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
              <label className="check-approval">
                <input
                  type="checkbox"
                  checked={approvedCheckIds.includes(check.id)}
                  onChange={(event) => toggleApprovedCheck(check, event.target.checked)}
                />
                Aprovar este check para execução autônoma
              </label>
              {checks.length > 1 && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => {
                    setApprovedCheckIds((ids) => ids.filter((id) => id !== check.id));
                    onProfileReady(false);
                    setChecks((current) => current.filter((_, item) => item !== index));
                  }}
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
          <h3>Contexto permitido para os agentes</h3>
          <p className="muted">
            Informe arquivos individuais, um por linha, no formato <code>caminho | PAPEL</code>.
            Cada caminho precisa estar permitido acima e fora dos caminhos proibidos.
          </p>
          <label>
            Fontes do contexto
            <textarea
              value={contextSources}
              onChange={(event) => {
                setContextSources(event.target.value);
                onProfileReady(false);
              }}
              placeholder="README.md | INSTRUCTION\nsrc/index.ts | SOURCE\ntests/app.test.ts | TEST"
            />
          </label>
          <h3>Documentação obrigatória para entrega</h3>
          <p className="muted">
            Inclua README, índice, changelog, backlog e lessons conforme as regras deste projeto.
            Cada arquivo listado deve ser atualizado no incremento e estar nos caminhos permitidos.
            O relatório precisa registrar a revisão base e os checks; o Reviewer confere conteúdo e
            critérios.
          </p>
          <label>
            Arquivos Markdown, um por linha
            <textarea
              value={docFiles}
              onChange={(event) => {
                setDocFiles(event.target.value);
                onProfileReady(false);
              }}
              placeholder="README.md\ndocs/INDEX.md\nCHANGELOG.md\nBACKLOG.md\ndocs/09-entregas/2026/entrega-atual.md"
            />
          </label>
          <label>
            Caminho do relatório
            <input
              value={docReport}
              onChange={(event) => {
                setDocReport(event.target.value);
                onProfileReady(false);
              }}
              placeholder="docs/09-entregas/2026/entrega-atual.md"
            />
          </label>
          <label>
            Seções obrigatórias no relatório, uma por linha
            <textarea
              value={docSections}
              onChange={(event) => {
                setDocSections(event.target.value);
                onProfileReady(false);
              }}
            />
          </label>
          <button type="submit">Salvar definição</button>
        </>
      )}
    </form>
  );
}
