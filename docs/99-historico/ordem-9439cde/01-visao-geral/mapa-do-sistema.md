# Mapa didático do sistema atual

Base a2cc5e0; implementação inspecionada, operação real NÃO VERIFICADA nesta migração.

```mermaid
flowchart LR
  U[Operador] --> P[Painel React]
  P --> T[Ticket READY no NestJS]
  T --> O[Outbox PostgreSQL]
  O --> Q[Fila BullMQ / Redis]
  Q --> W[Worker / claim fenced]
  W --> A[Cliente oficial / perfil nativo]
  W --> S[Sandbox de checks]
  A --> C[Snapshot, revisão e docs]
  S --> C
  C --> H[Aceite humano por digest]
```

[C4 e canais](../02-arquitetura/containers.md), [fluxo detalhado](../02-arquitetura/fluxos.md). Broker/tenancy são [direção posterior](../02-arquitetura/containers-alvo.md), sem seta para controle/auth/DB/Redis na sandbox ou broker.
