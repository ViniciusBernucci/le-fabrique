# Contratos: implementação e proposta

Fonte única executável: [Zod compartilhado](../../packages/contracts/src/index.ts) e [Prisma/migrations](../../apps/api/prisma/schema.prisma). Código prevalece para implementação; intenção aprovada/proposta é registrada separadamente. Base a2cc5e0, sem teste HTTP/DB/provider nesta migração.

- [Controle](api/controle.md), [catálogo completo de rotas físicas](api/catalogo-rotas.md), [worker](api/worker.md), [runtime](api/runtime.md).
- [Entidades](schemas/entidades.md), [estados por entidade](schemas/workflow.md), [checkpoint](schemas/checkpoint.md), [artefato/contexto](schemas/artifact-context.md).
- [Outbox/fila](filas/dispatch.md), [eventos](eventos/catalogo.md).
- [JobPackage v3 PROPOSTO](schemas/job-package.md), [ESPEC local integral com errata](especificacao-v2.3.md).

Cada contrato identifica auth/produtor/consumidores/request/response/erros/efeitos/concorrência/versão/exemplo/teste ou lacuna explícita. Não há OpenAPI completo nem schema do erro HTTP versionado; os controllers são evidência da rota real. Tenancy/broker/capabilities v3 não possuem schemas executáveis nesta base.
