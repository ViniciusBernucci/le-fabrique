// Presentation only: the original message and all API/state handling stay in App.
export function systemMessageTone(message: string): "OK" | "INFO" | "ATENÇÃO" | "ERRO" {
  if (/falha|inválid|não confirmado|não promovido|não foi possível/i.test(message)) return "ERRO";
  if (/revise|recarregue|bloquead|aguarde|não confirmada|mudou/i.test(message)) return "ATENÇÃO";
  if (/ativa\.|cadastrad|salv[ao]|configurad|pronto e evento|verificad[ao]/i.test(message))
    return "OK";
  return "INFO";
}
export function HudSystemMessage({ message }: { message: string }) {
  const tone = systemMessageTone(message);
  return (
    <p className="message hud-message" role="status" data-tone={tone}>
      {message && (
        <span className="hud-message-tag" aria-hidden="true">
          {tone}
        </span>
      )}
      {message}
    </p>
  );
}
