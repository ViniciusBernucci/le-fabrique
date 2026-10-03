import type { OperationStatus } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { getOperationStatus } from "./control-api";
import { pollResource } from "./poll-resource";

export function OperationPanel({ token }: { token: string }) {
  const [status, setStatus] = useState<OperationStatus | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setStatus(null);
    setError(false);
    return pollResource(
      (signal) => {
        setStatus(null);
        setError(false);
        return getOperationStatus(token, signal);
      },
      (value) => {
        setStatus(value);
        setError(false);
      },
      () => {
        setStatus(null);
        setError(true);
      },
    );
  }, [token]);
  return <OperationStatusView status={status} error={error} />;
}

const heartbeatLabels = {
  RECENT: "Heartbeat recente",
  STALE: "Sem heartbeat recente",
  OFFLINE: "Executor offline",
  CLOCK_SKEW: "Horário do heartbeat inconsistente",
};

export function OperationStatusView({
  status,
  error,
}: {
  status: OperationStatus | null;
  error: boolean;
}) {
  return (
    <section className="panel" aria-label="Estado da fábrica">
      <h2>Estado da fábrica</h2>
      {!status ? (
        <p role="status">
          {error
            ? "Estado indisponível. A execução não pode ser considerada pronta."
            : "Consultando estado da fábrica…"}
        </p>
      ) : (
        <>
          <p className="muted">
            Observado em {new Date(status.observedAt).toLocaleString("pt-BR")} · atualização a cada
            10 segundos.
          </p>
          <h3>Executor</h3>
          {status.workers.length === 0 ? (
            <p>Nenhum executor registrado.</p>
          ) : (
            <ul>
              {status.workers.map((worker) => (
                <li key={worker.id}>
                  <strong>{worker.name}</strong>: {heartbeatLabels[worker.heartbeatState]} · último
                  heartbeat {new Date(worker.lastHeartbeatAt).toLocaleString("pt-BR")}
                </li>
              ))}
            </ul>
          )}
          {status.workersTruncated && <p>Exibindo os primeiros 100 executores registrados.</p>}
          <h3>Escritor global</h3>
          {!status.writerGuardInstalled && (
            <p role="status">
              Proteção global ausente ou inválida no banco. Aplique a migração antes de ativar
              execuções.
            </p>
          )}
          {status.unresolvedWriterCount === 0 ? (
            <p>Nenhuma tentativa aguarda confirmação de parada.</p>
          ) : (
            <>
              <p role="status">
                {status.unresolvedWriterCount} tentativa(s) sem parada confirmada. Novo escritor
                bloqueado.
              </p>
              <ul>
                {status.writers.map((writer) => (
                  <li key={writer.attemptId}>
                    Tentativa <code>{writer.attemptId}</code>:{" "}
                    {writer.leaseState === "EXPIRED"
                      ? "lease vencida; parada continua desconhecida"
                      : "lease ativa; execução em andamento"}
                  </li>
                ))}
              </ul>
              {status.unresolvedWriterCount > 10 && (
                <p>
                  Exibindo as primeiras 10 tentativas. Diagnostique a inconsistência antes de
                  migrar.
                </p>
              )}
            </>
          )}
          <p className="muted">
            Heartbeat recente não comprova login, assinatura ou permissões da IA. Configure e
            verifique os clientes em Configurações.
          </p>
        </>
      )}
    </section>
  );
}
