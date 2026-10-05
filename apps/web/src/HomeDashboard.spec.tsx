import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HomeDashboard } from "./HomeDashboard";

it("identifies synthetic information and renders the local illustration without administrative data", () => {
  const html = renderToStaticMarkup(<HomeDashboard onNavigate={() => undefined} />);
  expect(html).toContain("Central de controle La fabrique");
  expect(html).toContain("dados simulados");
  expect(html).toContain("/images/control-room-reference.png");
  expect(html).toContain("Mensagens importantes");
  expect(html).not.toContain("adminToken");
  expect(html).not.toContain("Bearer");
});

it("keeps collapsed navigation accessible and distinguishes activity from quota", () => {
  const html = renderToStaticMarkup(<HomeDashboard onNavigate={() => undefined} />);
  expect(html).toContain('aria-label="Projetos"');
  expect(html).toContain('aria-label="Configurações"');
  expect(html).toContain('aria-current="page"');
  expect(html).toContain('aria-label="Atividade simulada de JARVIS"');
  expect(html).toContain('aria-label="Abrir JARVIS"');
  expect(html).toContain('aria-labelledby="home-preview-title"');
});
