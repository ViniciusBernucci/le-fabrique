import type { RunDetail } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { requestRunRecovery } from "./control-api";
export function RunRecoveryPanel({ token, run }: { token: string; run: RunDetail }) {
  const attemptId = run.attempts[0]?.id;
  const eligible = !!attemptId && ["RUNNING", "BLOCKED_RECOVERY"].includes(run.status);
  const [confirmation, setConfirmation] = useState<number | null>(null);
  const [requestedVersion, setRequestedVersion] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!eligible || !attemptId || confirmation !== run.version || requestedVersion !== run.version)
      return;
    const abort = new AbortController();
    void requestRunRecovery(
      token,
      run.id,
      { expectedVersion: requestedVersion, attemptId },
      abort.signal,
    )
      .then(() => {
        if (!abort.signal.aborted)
          setMessage(
            "Recuperação solicitada. Somente evidência de parada íntegra permite concluir; ausência de prova mantém bloqueado.",
          );
      })
      .catch(() => {
        if (!abort.signal.aborted) setMessage("Pedido não confirmado. Atualize antes de repetir.");
      });
    return () => abort.abort();
  }, [token, run.id, run.version, eligible, attemptId, confirmation, requestedVersion]);
  if (!eligible) return null;
  return (
    <fieldset>
      <legend>Recuperação da entrega</legend>
      <p>
        Reenvia resultado preservado ou reconcilia checkpoint. Não executa IA, não inicia outro
        writer e não presume que um processo morreu.
      </p>
      <label>
        <input
          type="checkbox"
          checked={confirmation === run.version}
          disabled={requestedVersion !== null}
          onChange={(event) => setConfirmation(event.target.checked ? run.version : null)}
        />
        Solicito recuperar somente a finalização desta tentativa.
      </label>
      <button
        type="button"
        disabled={confirmation !== run.version || requestedVersion !== null}
        onClick={() => setRequestedVersion(run.version)}
      >
        Recuperar entrega pendente
      </button>
      <p role="status">{message}</p>
    </fieldset>
  );
}
