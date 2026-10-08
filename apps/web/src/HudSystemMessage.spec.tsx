import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HudSystemMessage, systemMessageTone } from "./HudSystemMessage";

it.each([
  ["Informe o token administrativo.", "INFO"],
  ["Sessão administrativa ativa.", "OK"],
  ["Falha ao carregar tickets.", "ERRO"],
  ["Revise os dados e os critérios do ticket.", "ATENÇÃO"],
  ["Pedido não confirmado.", "ERRO"],
])("preserves system message %s and adds its presentation tone", (message, tone) => {
  expect(systemMessageTone(message)).toBe(tone);
  const html = renderToStaticMarkup(<HudSystemMessage message={message} />);
  expect(html).toContain(message);
  expect(html).toContain('role="status"');
  expect(html).toContain(`data-tone="${tone}"`);
  expect(html).toContain('aria-hidden="true"');
});
