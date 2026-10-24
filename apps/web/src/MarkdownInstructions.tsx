import { useEffect, useId, useRef, useState } from "react";
import { readMarkdownInstructions } from "./markdown-instructions";

export function MarkdownInstructions({
  label,
  instructions,
  filename,
  fallbackFilename,
  maxCharacters,
  onChange,
  onBusyChange,
}: {
  label: string;
  instructions: string;
  filename?: string;
  fallbackFilename: string;
  maxCharacters: number;
  onChange: (instructions: string, filename: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const mounted = useRef(false);
  const helpId = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!instructions) {
      setDownloadUrl("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([instructions], { type: "text/markdown;charset=utf-8" }),
    );
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [instructions]);
  async function selectFile(file: File) {
    setError("");
    setReading(true);
    onBusyChange(true);
    try {
      const result = await readMarkdownInstructions(file, maxCharacters);
      if (mounted.current) onChange(result.instructions, result.instructionsFilename);
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo.");
    } finally {
      if (mounted.current) {
        setReading(false);
        onBusyChange(false);
      }
    }
  }
  return (
    <fieldset className="markdown-instructions">
      <legend>{label}</legend>
      <p id={helpId} className="muted">
        Adicione um arquivo .md com as instruções. A descrição acima é apenas um resumo. Limite:{" "}
        {maxCharacters.toLocaleString("pt-BR")} caracteres em UTF-8.
      </p>
      <label>
        {instructions ? "Substituir arquivo .md" : "Adicionar arquivo .md"}
        <input
          type="file"
          accept=".md,text/markdown"
          disabled={reading}
          aria-describedby={helpId}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void selectFile(file);
          }}
        />
      </label>
      {reading && <p role="status">Lendo arquivo…</p>}
      {instructions && (
        <div className="instructions-download">
          <span>{filename || fallbackFilename}</span>
          {downloadUrl && (
            <a href={downloadUrl} download={filename || fallbackFilename}>
              Baixar arquivo .md
            </a>
          )}
        </div>
      )}
      {!instructions && <p className="muted">Nenhum arquivo adicionado.</p>}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
