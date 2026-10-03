import type { RunDetail, RunSummary } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { ArtifactPanel } from "./ArtifactPanel";
import { getRun, listRuns } from "./control-api";
import { DeliveryPanel } from "./DeliveryPanel";
import { pollResource } from "./poll-resource";
import { RunControlPanel } from "./RunControlPanel";
import { RunRecoveryPanel } from "./RunRecoveryPanel";
import { RunResumePanel } from "./RunResumePanel";

const statusLabels: Record<string, string> = {
  WAITING_WORKER: "Aguardando executor",
  RUNNING: "Em execução",
  VALIDATING: "Aguarda validação humana",
  AWAITING_HUMAN: "Aguarda validação humana",
  DONE: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  PAUSED_LIMIT: "Pausada por limite",
  PAUSED: "Pausada pelo operador",
  BLOCKED_RECOVERY: "Recuperação necessária",
  WAITING_PROVIDER: "Aguardando IA",
  AUTH_REQUIRED: "Login necessário",
  PAUSED_RESOURCE: "Pausada por recursos",
  REVIEW: "Em revisão",
  DOCS: "Documentação",
};

export function RunPanel({ token, projectId }: { token: string; projectId: string }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setRuns([]);
    setSelected("");
    setDetail(null);
    setMessage(refresh > 0 ? "Atualizando execuções…" : "");
    if (!projectId) return;
    return pollResource(
      (signal) => listRuns(token, projectId, signal),
      (items) => {
        setRuns(items);
        setSelected((previous) =>
          items.some((item) => item.id === previous) ? previous : (items[0]?.id ?? ""),
        );
        setMessage("");
      },
      () => setMessage("Falha ao carregar execuções."),
    );
  }, [token, projectId, refresh]);

  useEffect(() => {
    setDetail(null);
    if (!selected) return;
    return pollResource(
      (signal) => getRun(token, selected, signal),
      (result) => {
        if (result.projectId === projectId) setDetail(result);
      },
      () => setMessage("Falha ao carregar o resultado da execução."),
    );
  }, [token, projectId, selected]);

  return (
    <section className="panel run-panel" aria-label="Execuções do projeto">
      <div className="run-heading">
        <h2>Execuções</h2>
        <button
          type="button"
          disabled={!projectId}
          onClick={() => setRefresh((value) => value + 1)}
        >
          Atualizar
        </button>
      </div>
      <p role="status">{message}</p>
      {!projectId ? (
        <p className="muted">Selecione um projeto.</p>
      ) : runs.length === 0 ? (
        <p className="muted">As execuções aparecem quando o executor inicia um ticket.</p>
      ) : (
        <div className="run-layout">
          <fieldset className="run-list">
            <legend>Lista de execuções</legend>
            {runs.map((run) => (
              <button
                type="button"
                key={run.id}
                aria-pressed={selected === run.id}
                onClick={() => setSelected(run.id)}
              >
                <strong>{run.title}</strong>
                <span>{statusLabels[run.status] ?? run.status}</span>
              </button>
            ))}
          </fieldset>
          {detail ? (
            <RunResultView run={detail} token={token} />
          ) : (
            <p className="muted">Carregando resultado…</p>
          )}
        </div>
      )}
    </section>
  );
}

export function RunResultView({ run, token }: { run: RunDetail; token?: string }) {
  return (
    <div className="run-details">
      <h3>{run.title}</h3>
      <p>{statusLabels[run.status] ?? run.status}</p>
      {token && <RunControlPanel key={run.id} token={token} run={run} />}
      {token && <RunResumePanel key={run.id} token={token} run={run} />}
      {token && <RunRecoveryPanel key={run.id} token={token} run={run} />}
      {token && <DeliveryPanel key={run.id} token={token} runId={run.id} version={run.version} />}
      {run.attempts.map((attempt) => (
        <article key={attempt.id}>
          <h4>Tentativa {attempt.sequence}</h4>
          {token && (
            <ArtifactPanel
              key={`${run.id}-${attempt.id}`}
              token={token}
              runId={run.id}
              attemptId={attempt.id}
            />
          )}
          <p className="muted">
            {attempt.stoppedConfirmed ? "Parada confirmada" : "Parada ainda não confirmada"}
          </p>
          {attempt.result ? (
            <>
              <p>{attempt.result.diagnostic}</p>
              <h4>Verificações</h4>
              <div className="run-table">
                <table>
                  <thead>
                    <tr>
                      <th>Check</th>
                      <th>Etapa</th>
                      <th>Resultado</th>
                      <th>Falha anterior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempt.result.checks.map((check) => (
                      <tr key={`${check.phase}-${check.round}-${check.name}`}>
                        <td>{check.name}</td>
                        <td>
                          {check.phase === "BASELINE"
                            ? "Antes da alteração"
                            : `Após alteração ${check.round + 1}`}
                        </td>
                        <td>
                          {!check.stoppedConfirmed
                            ? "Parada não confirmada"
                            : check.status === "COMPLETED" && check.exitCode === 0
                              ? "Passou"
                              : "Falhou"}
                        </td>
                        <td>{check.preExisting ? "Sim" : "Não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {attempt.result.review && (
                <div>
                  <h4>Revisão de IA</h4>
                  <p>
                    {attempt.result.review.verdict === "APPROVE"
                      ? "Aprovada pela revisão de IA"
                      : "Alterações solicitadas"}
                  </p>
                  <p>{attempt.result.review.summary}</p>
                  {attempt.result.review.findings.length > 0 && (
                    <ul>
                      {[...new Set(attempt.result.review.findings)].map((finding) => (
                        <li key={finding}>{finding}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <h4>Chamadas de IA</h4>
              {attempt.result.runtimeObservations.length === 0 ? (
                <p className="muted">Sem observações de modelo ou uso nesta tentativa.</p>
              ) : (
                attempt.result.runtimeObservations.map((observation) => (
                  <div key={observation.executionId}>
                    <p>
                      <strong>
                        {observation.role === "DEVELOPER" ? "Desenvolvimento" : "Revisão"}
                      </strong>{" "}
                      · {observation.provider} · instalação configurada:{" "}
                      {observation.installationId}
                    </p>
                    <p className="muted">
                      Modelo solicitado: {observation.modelRequested ?? "Não informado"}. Modelo
                      observado: {observation.modelEffective ?? "Não informado pelo cliente"}.
                    </p>
                    <p className="muted">
                      {observation.usage
                        ? `Tokens observados: ${observation.usage.inputTokens} entrada, ${observation.usage.outputTokens} saída.`
                        : "Uso não informado pelo cliente."}
                    </p>
                  </div>
                ))
              )}
              <h4>Versões preservadas</h4>
              {attempt.result.snapshots.map((snapshot) => (
                <div key={snapshot.snapshotId} className="run-snapshot">
                  <p>
                    Snapshot <code>{snapshot.snapshotId}</code>
                  </p>
                  <p className="muted">
                    {snapshot.patchBytes} bytes de patch · {snapshot.untrackedFiles} arquivos novos
                    · digest <code>{snapshot.manifestHash}</code>
                  </p>
                </div>
              ))}
            </>
          ) : (
            <p className="muted">O executor ainda não publicou um relatório para esta tentativa.</p>
          )}
        </article>
      ))}
    </div>
  );
}
