import type { RunDetail } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { getExecutionArtifact, requestRunResume } from "./control-api";

export function RunResumePanel({ token, run }: { token: string; run: RunDetail }) {
  const attempt = run.attempts[0];
  const attemptId = attempt?.id;
  const eligible =
    ["PAUSED", "PAUSED_LIMIT", "FAILED", "CANCELLED"].includes(run.status) &&
    !!attempt?.stoppedConfirmed &&
    !!attempt.checkpoint?.stoppedConfirmed &&
    !!attempt.result?.snapshots.length;
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [requestedVersion, setRequestedVersion] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (
      !eligible ||
      !attemptId ||
      requestedVersion !== run.version ||
      confirmVersion !== run.version
    )
      return;
    const abort = new AbortController();
    void (async () => {
      setMessage("Verificando snapshot antes de solicitar retomada…");
      const { artifact } = await getExecutionArtifact(token, run.id, attemptId, abort.signal);
      if (!artifact || abort.signal.aborted) throw new Error("Resume artifact missing");
      const bytes = new TextEncoder().encode(JSON.stringify(artifact));
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const artifactDigest = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      await requestRunResume(
        token,
        run.id,
        { expectedVersion: requestedVersion, attemptId, artifactDigest },
        abort.signal,
      );
      if (!abort.signal.aborted)
        setMessage(
          "Retomada solicitada. Uma nova tentativa aguardará o executor; nenhuma sessão privada foi reaproveitada.",
        );
    })().catch(() => {
      if (!abort.signal.aborted)
        setMessage(
          "Retomada não confirmada. Atualize e confira snapshot, parada e versão antes de repetir.",
        );
    });
    return () => abort.abort();
  }, [token, run.id, run.version, eligible, attemptId, requestedVersion, confirmVersion]);
  if (!eligible) return null;
  return (
    <fieldset>
      <legend>Retomada do trabalho preservado</legend>
      <p>
        Continua o objetivo original em nova tentativa com snapshot verificado. Os limites de
        chamadas/tempo reiniciam para a tentativa autorizada; contas e modelos vêm da configuração
        atual.
      </p>
      <label>
        <input
          type="checkbox"
          checked={confirmVersion === run.version}
          disabled={requestedVersion !== null}
          onChange={(event) => setConfirmVersion(event.target.checked ? run.version : null)}
        />
        Autorizo nova tentativa a partir deste trabalho preservado.
      </label>
      <button
        type="button"
        disabled={confirmVersion !== run.version || requestedVersion !== null}
        onClick={() => setRequestedVersion(run.version)}
      >
        Retomar do snapshot
      </button>
      <p role="status">{message}</p>
    </fieldset>
  );
}
