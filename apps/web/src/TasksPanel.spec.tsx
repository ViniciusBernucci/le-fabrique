import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DashboardLayout } from "./DashboardLayout";
import { TasksPanel } from "./TasksPanel";

it("opens an accessible task destination with clear mock boundaries", () => {
  const html = renderToStaticMarkup(
    <DashboardLayout activeDestination="tasks" onNavigate={() => undefined}>
      <TasksPanel />
    </DashboardLayout>,
  );
  expect(html).toMatch(/aria-label="Tarefas"[^>]*class="is-active" aria-current="page"/);
  expect(html).toContain("Demonstração · dados mockados");
  expect(html).toContain("não executam agentes");
  expect(html).toContain("Remover tickets de exemplo");
  expect(html).toContain("Simular onboarding");
  expect(html).toContain("Quadro de tarefas");
  expect(html).toContain("Validar atribuição de responsáveis");
  expect(html).toContain("Tech Lead");
  expect(html).not.toContain("Bearer");
});
