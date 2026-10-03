import type { OperationStatus } from "@le-fabrique/contracts";
import { useEffect, useRef, useState } from "react";
import { getOperationStatus, updateFactoryScheduling } from "./control-api";
import { pollResource } from "./poll-resource";

export function OperationPanel({ token }: { token: string }) {
  const epoch = useRef(0);
  const schedulingVersion = useRef(0);
  const [status, setStatus] = useState<OperationStatus | null>(null);
  const [changing, setChanging] = useState(false);
  const [controlMessage, setControlMessage] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    epoch.current++;
    schedulingVersion.current = 0;
    setChanging(false);
    setControlMessage("");
    setStatus(null);
    setError(false);
    const stop = pollResource(
      (signal) => {
        setStatus(null);
        setError(false);
        return getOperationStatus(token, signal);
      },
      (value) => {
        if (value.scheduling && value.scheduling.version < schedulingVersion.current) return;
        schedulingVersion.current = value.scheduling?.version ?? 0;
        setStatus(value);
        setError(false);
      },
      () => {
        setStatus(null);
        setError(true);
      },
    );
    return () => {
      epoch.current++;
      stop();
    };
  }, [token]);
  async function toggleScheduling() {
    const scheduling = status?.scheduling;
    if (!scheduling || changing) return;
    const generation = epoch.current;
    setChanging(true);
    try {
      const updated = await updateFactoryScheduling(token, {
        expectedVersion: scheduling.version,
        paused: !scheduling.paused,
      });
      if (epoch.current !== generation) return;
      schedulingVersion.current = updated.version;
      setStatus(null);
      setControlMessage(
        updated.paused
          ? "Pausa solicitada. Aguarde confirmação de parada das tentativas."
          : "Agendamento retomado. Execuções pausadas precisam de retomada explícita.",
      );
      const observed = await getOperationStatus(token);
      if (
        epoch.current === generation &&
        (observed.scheduling?.version ?? 0) >= schedulingVersion.current
      ) {
        setStatus(observed);
        setError(false);
      }
    } catch {
      if (epoch.current !== generation) return;
      setStatus(null);
      setControlMessage(
        "Agendamento não alterado ou resposta indisponível; confira o estado atualizado antes de repetir.",
      );
    } finally {
      if (epoch.current === generation) setChanging(false);
    }
  }
  return (
    <OperationStatusView
      status={status}
      error={error}
      onToggle={toggleScheduling}
      changing={changing}
      controlMessage={controlMessage}
    />
  );
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
  onToggle,
  changing = false,
  controlMessage = "",
}: {
  status: OperationStatus | null;
  error: boolean;
  onToggle?: () => void;
  changing?: boolean;
  controlMessage?: string;
}) {
  return (
    <section className="panel" aria-label="Estado da fábrica">
      <h2>Estado da fábrica</h2>
      {controlMessage && <p role="status">{controlMessage}</p>}
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
          <h3>Agendamento</h3>
          {status.scheduling ? (
            <>
              <p>
                {status.scheduling.paused
                  ? "Fábrica pausada: novos escritores bloqueados; parada dos ativos é solicitada na próxima renovação."
                  : "Agendamento liberado. A elegibilidade de IA e os gates de execução continuam necessários."}
              </p>
              {onToggle && (
                <button
                  type="button"
                  disabled={
                    changing || (!status.scheduling.paused ? false : !status.writerGuardInstalled)
                  }
                  onClick={onToggle}
                >
                  {changing
                    ? "Alterando…"
                    : status.scheduling.paused
                      ? "Retomar agendamento"
                      : "Pausar fábrica"}
                </button>
              )}
            </>
          ) : (
            <p>Agendamento não inicializado. Novos escritores bloqueados.</p>
          )}
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
