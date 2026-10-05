import type { RunDetail } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { requestRunControl } from "./control-api";

export function RunControlPanel({ token, run }: { token: string; run: RunDetail }) {
  const [confirmedVersion, setConfirmedVersion] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [requested, setRequested] = useState<{
    action: "PAUSE" | "CANCEL";
    version: number;
  } | null>(null);
  const confirmed = confirmedVersion === run.version;
  const attempt = run.attempts[0];
  const attemptId = attempt?.id;
  const eligible =
    run.status === "RUNNING" && attempt?.status === "RUNNING" && !attempt.stoppedConfirmed;
  useEffect(() => {
    if (
      !requested ||
      requested.version !== run.version ||
      !attemptId ||
      !eligible ||
      run.controlAction
    )
      return;
    const controller = new AbortController();
    setPending(true);
    void requestRunControl(
      token,
      run.id,
      { action: requested.action, attemptId, expectedVersion: requested.version },
      controller.signal,
    )
      .then(() => {
        if (!controller.signal.aborted)
          setMessage("Pedido registrado. Aguarde a confirmação de parada pelo executor.");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("Pedido não confirmado. Atualize a execução antes de tentar novamente.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPending(false);
        }
      });
    return () => controller.abort();
  }, [token, run.id, run.version, run.controlAction, attemptId, eligible, requested]);
  function submit(action: "PAUSE" | "CANCEL") {
    if (!eligible || !confirmed || pending || run.controlAction || !attempt || requested) return;
    setRequested({ action, version: run.version });
  }
  if (!eligible) return null;
  return (
    <fieldset>
      <legend>Controle da execução</legend>
      <p>
        Pausar ou cancelar preserva o trabalho após parada comprovada. O pedido não encerra o
        processo imediatamente.
      </p>
      {run.controlAction ? (
        <p role="status">
          {run.controlAction === "PAUSE" ? "Pausa" : "Cancelamento"} solicitado; parada ainda não
          confirmada.
        </p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={pending}
              onChange={(event) => setConfirmedVersion(event.target.checked ? run.version : null)}
            />
            Confirmo que desejo interromper esta tentativa.
          </label>
          <button
            type="button"
            disabled={!confirmed || pending || !!requested}
            onClick={() => void submit("PAUSE")}
          >
            Pausar
          </button>
          <button
            type="button"
            disabled={!confirmed || pending || !!requested}
            onClick={() => void submit("CANCEL")}
          >
            Cancelar execução
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </fieldset>
  );
}
