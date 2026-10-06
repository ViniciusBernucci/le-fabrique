import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardLayout } from "./DashboardLayout";

it("shares the navigation frame with custom content and marks the active destination", () => {
  const html = renderToStaticMarkup(
    <DashboardLayout onNavigate={() => undefined} activeDestination="settings">
      <h1>Conteúdo administrativo</h1>
    </DashboardLayout>,
  );
  expect(html).toContain("Conteúdo administrativo");
  expect(html).toContain('class="workspace-content"');
  expect(html).toContain('class="home-sidebar"');
  expect(html).toContain('class="home-topbar"');
  expect(html).toMatch(/aria-label="Configurações" class="is-active" aria-current="page"/);
  expect(html).not.toContain("Escritório virtual da equipe");
});
