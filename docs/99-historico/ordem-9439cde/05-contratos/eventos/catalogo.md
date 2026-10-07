# Eventos observados

Base a2cc5e0; conferência por leitura local, testes NOT_RUN nesta migração.

Eventos de outbox de execução: ticket.ready.v1, run.resume.v1, run.finalization-recovery.v1. Integrações provider/GitHub têm tipos próprios nos dispatchers; não tratar eventos raw do cliente como autoridade. Eventos de projeto persistidos pelos triggers são invalidação minimizada por entidade, sequência bigint como string decimal; SSE project-change/heartbeat com Bearer/Last-Event-ID. Página até 100; reconexão/fallback HTTP no painel. Cursor é transacional, sem nextval como prova de ordem de commit. Model output não concede budget/aceite nem autoriza tools administrativas; sem stream de raciocínio privado.

## Fonte, versão e compatibilidade

[Schemas Zod canônicos](../../../packages/contracts/src/index.ts), [AS-IS](../../02-arquitetura/as-is.md), [responsabilidades e código](../../03-modulos/README.md). Requests/responses completos pertencem ao schema, sem cópia concorrente. Alteração exige teste positivo/negativo, compatibilidade de consumidores e entrega em ticket próprio.
