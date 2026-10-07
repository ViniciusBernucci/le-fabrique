> Leitura: [← Anterior](05-fluxos.md) · [Índice didático](../02-INDEX.md) · [Próximo →](07-fronteiras-e-invariantes.md)

# Dados — estrutura observada

Base a2cc5e0, conferido em schema Prisma. Migrations podem impor invariantes adicionais. [Contrato de dados](../05-contratos/schemas/00-entidades.md).

```mermaid
erDiagram
  Project ||--o| ProjectDefinition : configura
  Project ||--o{ Ticket : organiza
  Ticket ||--o| Run : executa
  Run ||--o{ Attempt : tenta
  Attempt ||--o| Checkpoint : preserva
  Project ||--o{ ProjectEvent : invalida
  Project ||--o| ProjectEventCursor : sequencia
```

Run único por ticket; resultados/artifacts/approval/configuração são JSON. OutboxEvent persiste intenção no banco, Redis transporta. Nenhuma tenancy/RLS/Step/Ledger físico nesta revisão. [Dados alvo propostos](14-dados-alvo.md).
