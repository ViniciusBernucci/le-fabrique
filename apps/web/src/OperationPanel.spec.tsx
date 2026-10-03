import { operationStatusSchema } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OperationStatusView } from "./OperationPanel";

function fixture() {
  return operationStatusSchema.parse({
    observedAt: "2026-10-03T20:00:00Z",
    scheduling: { paused: true, version: 1, updatedAt: "2026-10-03T20:00:00Z" },
    heartbeatMaxAgeMs: 180_000,
    workersTruncated: false,
    workers: [],
    writerGuardInstalled: true,
    unresolvedWriterCount: 0,
    writers: [],
  });
}
it("shows factory state without needing any project or pilot", () => {
  const html = renderToStaticMarkup(<OperationStatusView status={fixture()} error={false} />);
  expect(html).toContain("Nenhum executor registrado");
  expect(html).toContain("Nenhuma tentativa aguarda");
  expect(html).not.toContain("piloto");
});
it("shows missing protection and unknown stop even when lease expired", () => {
  const state = fixture();
  state.writerGuardInstalled = false;
  state.unresolvedWriterCount = 1;
  state.writers = [
    {
      attemptId: crypto.randomUUID(),
      runId: crypto.randomUUID(),
      workerId: crypto.randomUUID(),
      leaseExpiresAt: state.observedAt,
      leaseState: "EXPIRED",
    },
  ];
  const html = renderToStaticMarkup(<OperationStatusView status={state} error={false} />);
  expect(html).toContain("Proteção global ausente");
  expect(html).toContain("parada continua desconhecida");
  expect(html).toContain("Novo escritor bloqueado");
});
it("does not label stale heartbeat or escaped worker names as healthy execution", () => {
  const state = fixture();
  state.workers = [
    {
      id: crypto.randomUUID(),
      name: "<script>synthetic</script>",
      lastHeartbeatAt: state.observedAt,
      heartbeatState: "STALE",
    },
  ];
  const html = renderToStaticMarkup(<OperationStatusView status={state} error={false} />);
  expect(html).toContain("Sem heartbeat recente");
  expect(html).not.toContain("<script>");
  expect(html).toContain("não comprova login");
});
it("shows pending/error as unknown instead of readiness", () => {
  expect(renderToStaticMarkup(<OperationStatusView status={null} error={false} />)).toContain(
    "Consultando",
  );
  expect(renderToStaticMarkup(<OperationStatusView status={null} error />)).toContain(
    "Estado indisponível",
  );
});
it("rejects extra secret fields and inconsistent writer samples at runtime", () => {
  expect(operationStatusSchema.safeParse({ ...fixture(), credentials: "synthetic" }).success).toBe(
    false,
  );
  expect(operationStatusSchema.safeParse({ ...fixture(), unresolvedWriterCount: 1 }).success).toBe(
    false,
  );
});

it("shows global scheduling controls and never claims that requesting pause proves stop", () => {
  const state = fixture();
  let html = renderToStaticMarkup(
    <OperationStatusView status={state} error={false} onToggle={() => undefined} />,
  );
  expect(html).toContain("Retomar agendamento");
  expect(html).toContain("parada dos ativos é solicitada");
  if (state.scheduling) state.scheduling.paused = false;
  html = renderToStaticMarkup(
    <OperationStatusView status={state} error={false} onToggle={() => undefined} />,
  );
  expect(html).toContain("Pausar fábrica");
  state.scheduling = null;
  expect(renderToStaticMarkup(<OperationStatusView status={state} error={false} />)).toContain(
    "Agendamento não inicializado",
  );
});
