import type { ExecutionArtifact } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { getExecutionArtifact } from "./control-api";

export function ArtifactPanel({
  token,
  runId,
  attemptId,
}: {
  token: string;
  runId: string;
  attemptId: string;
}) {
  const [requested, setRequested] = useState(false);
  const [artifact, setArtifact] = useState<ExecutionArtifact | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setArtifact(null);
    if (!requested) return;
    const abort = new AbortController();
    setMessage("Carregando artefatos…");
    void getExecutionArtifact(token, runId, attemptId, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) return;
        setArtifact(result.artifact);
        setMessage(result.artifact ? "" : "Artefatos ainda não disponíveis.");
      })
      .catch(() => {
        if (!abort.signal.aborted) setMessage("Não foi possível carregar os artefatos.");
      });
    return () => abort.abort();
  }, [token, runId, attemptId, requested]);
  return (
    <section aria-label="Diff e artefatos">
      <h4>Diff e artefatos</h4>
      {!requested && (
        <button type="button" onClick={() => setRequested(true)}>
          Carregar diff e arquivos
        </button>
      )}
      <p role="status">{message}</p>
      {artifact && <ArtifactView artifact={artifact} />}
    </section>
  );
}

export function ArtifactView({ artifact }: { artifact: ExecutionArtifact }) {
  const patch = new TextDecoder().decode(
    Uint8Array.from(atob(artifact.patchBase64), (char) => char.charCodeAt(0)),
  );
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `snapshot-${artifact.manifest.snapshotId}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <div className="execution-artifact">
      <p>
        Bundle íntegro: patch Git e arquivos novos em base64 (até 8 MiB JSON / 6 MiB de conteúdo,
        incluindo metadados no teto JSON). Baixar não aplica as alterações.
      </p>
      <button type="button" onClick={download}>
        Baixar bundle JSON
      </button>
      <p className="muted">
        SHA do manifesto: <code>{artifact.manifest.manifestHash}</code>
      </p>
      <pre>{patch || "Sem alterações em arquivos rastreados."}</pre>
      <h4>Arquivos novos</h4>
      {artifact.manifest.untracked.length === 0 ? (
        <p>Nenhum arquivo novo.</p>
      ) : (
        <ul>
          {artifact.manifest.untracked.map((file) => (
            <li key={file.path}>
              <code>{file.path}</code> · {file.sizeBytes} bytes · SHA <code>{file.sha256}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
