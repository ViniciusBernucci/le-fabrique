import type { RunDeliveryState } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { ArtifactPanel } from "./ArtifactPanel";
import { approveRunDelivery, getRunDelivery } from "./control-api";

export function DeliveryPanel({
  token,
  runId,
  version,
}: {
  token: string;
  runId: string;
  version: number;
}) {
  const [requested, setRequested] = useState(false);
  const [state, setState] = useState<RunDeliveryState | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submit, setSubmit] = useState(false);
  const [message, setMessage] = useState("");
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  useEffect(() => {
    setState(null);
    setConfirmed(false);
    setSubmit(false);
    setLoadedVersion(null);
    if (!requested) return;
    const abort = new AbortController();
    void getRunDelivery(token, runId, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setState(result);
          setLoadedVersion(version);
          setMessage(
            result.delivery
              ? ""
              : "Entrega ainda não elegível: confira checks, revisão, artefatos e parada.",
          );
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setMessage("Falha ao carregar a entrega.");
      });
    return () => abort.abort();
  }, [token, runId, version, requested]);
  useEffect(() => {
    if (!submit || !confirmed || !state?.delivery || state.accepted || loadedVersion !== version)
      return;
    const abort = new AbortController();
    void approveRunDelivery(
      token,
      runId,
      {
        expectedVersion: version,
        attemptId: state.delivery.attemptId,
        deliveryDigest: state.delivery.deliveryDigest,
      },
      abort.signal,
    )
      .then(() => {
        if (!abort.signal.aborted) {
          setState((previous) => (previous ? { ...previous, accepted: true } : previous));
          setMessage("Aceite registrado. Nenhum merge ou deploy foi executado.");
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setMessage(
            "Aceite não confirmado. Recarregue e confira a versão/evidência antes de tentar novamente.",
          );
          setSubmit(false);
        }
      });
    return () => abort.abort();
  }, [token, runId, version, loadedVersion, submit, confirmed, state]);
  function download() {
    if (!state?.delivery) return;
    const url = URL.createObjectURL(
      new Blob([state.delivery.documentMarkdown], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `entrega-${state.delivery.attemptId}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <section aria-label="Documentação e aceite da entrega">
      <h3>Documentação e aceite</h3>
      {!requested && (
        <button type="button" onClick={() => setRequested(true)}>
          Revisar entrega e documentação
        </button>
      )}
      <p role="status">{message}</p>
      {state?.delivery && (
        <>
          <p>
            Relatório de evidências gerado pela fábrica; não substitui documentação técnica dentro
            do projeto.
          </p>
          <button type="button" onClick={download}>
            Baixar relatório Markdown
          </button>
          <div className="execution-artifact">
            <pre>{state.delivery.documentMarkdown}</pre>
          </div>
          <ArtifactPanel
            key={state.delivery.attemptId}
            token={token}
            runId={runId}
            attemptId={state.delivery.attemptId}
          />
          {state.accepted ? (
            <p>Entrega aceita pelo responsável.</p>
          ) : (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={submit || loadedVersion !== version}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />{" "}
                Conferi os critérios, diff, arquivos, checks e documentação desta revisão exata.
              </label>
              <button
                type="button"
                disabled={!confirmed || submit || loadedVersion !== version}
                onClick={() => setSubmit(true)}
              >
                Aceitar esta entrega
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
