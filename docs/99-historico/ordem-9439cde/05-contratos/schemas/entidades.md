# Dados implementados e entidades propostas

[Schema Prisma canônico](../../../apps/api/prisma/schema.prisma) na revisão a2cc5e0. Modelos físicos: `Project`, `ProjectDefinition`, `Ticket`, `Run`, `Attempt`, `Checkpoint`, `OutboxEvent`, `WorkerIdentity`, `FactorySettings`, `ProviderVerification`, `ProviderOnboardingSession`, `GithubVerification`, `GithubOnboardingSession`, `GithubRepositoryVerification`, `GithubPullRequest`, `ProjectEventCursor`, `ProjectEvent`, `FactoryOperation`.

Project tem ProjectDefinition opcional e vários Tickets; Ticket tem Run opcional único; Run tem várias Attempts; Attempt tem Checkpoint opcional único. Result/artifact/approval/configuração são JSON/JSONB, não entidades físicas independentes de Ledger/Step/Usage. OutboxEvent é persistido no banco; ProjectEventCursor/ProjectEvent guardam cursor sequencial e invalidação; FactoryOperation é pausa global versionada/default true.

## Invariantes e limites

Chaves únicas ticketId/dispatchEventId, runId+sequence/fence, deduplicationKey; FKs Restrict. Índice parcial attempts_single_unconfirmed_writer e triggers/check constraints dependem das migrations SQL reais; schema Prisma sozinho não prova todos os controles. Snapshots/evidências ficam no filesystem privado e bundles validados no banco. Nenhum tenant_id, Membership, ProjectGrant, CredentialMetadata ou RLS versionados nesta base.

## Proposta posterior

[Tenancy/RLS](../../03-modulos/tenant-isolation/README.md) preserva cadeia/ownership/FKs compostas, pools LOCAL e testes SEC. JobPackage v3 é ilustrativo, sem schema implementado. Não atribuir dado órfão a tenant arbitrário. Dinheiro decimal/unknown são regras de direção; não há Ledger financeiro implementado a certificar.

## Compatibilidade e consumidores

API usa Prisma; painel/worker usam DTO Zod e nunca exportam credenciais/modelos de persistência ao bundle. Backup precisa preservar JSON, enums, índices, outbox, eventos/cursors e journal. Testes versionados e migrations são evidência de implementação; aplicação no DB ativo não foi inspecionada. [Enums atuais](workflow.md).
