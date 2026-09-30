import { type ReadinessResponse, readinessResponseSchema } from "@le-fabrique/contracts";
import { useEffect, useState } from "react";
import { readinessLabel } from "./health-view-model";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; data: ReadinessResponse }
  | { status: "failed" };

export function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL ?? "/api";

    fetch(`${apiUrl}/health/ready`, { signal: controller.signal })
      .then(async (response) => readinessResponseSchema.parse(await response.json()))
      .then((data) => setState({ status: "loaded", data }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "failed" });
        }
      });

    return () => controller.abort();
  }, []);

  const label = readinessLabel(state);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">LE FABRIQUE</p>
        <h1>Controle da fábrica</h1>
        <p className="subtitle">Fundação TypeScript pronta para evoluir por tickets.</p>
        <div className={`status status--${label.tone}`} role="status">
          <span className="status__dot" aria-hidden="true" />
          <div>
            <strong>{label.title}</strong>
            <span>{label.detail}</span>
          </div>
        </div>
      </section>
      <section className="grid" aria-label="Componentes da plataforma">
        <article>
          <span className="card-index">01</span>
          <h2>Painel</h2>
          <p>React, Vite e contratos validados em runtime.</p>
        </article>
        <article>
          <span className="card-index">02</span>
          <h2>Controle</h2>
          <p>NestJS, PostgreSQL e outbox transacional.</p>
        </article>
        <article>
          <span className="card-index">03</span>
          <h2>Execução</h2>
          <p>Worker isolado, Redis e BullMQ com concorrência inicial 1.</p>
        </article>
      </section>
    </main>
  );
}
