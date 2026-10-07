# Roteiro arquitetural da fábrica

Inspecionar apps/web (React), apps/api/src/controllers e serviços (Nest), schema/migrations Prisma, packages/contracts (Zod), apps/worker e packages/runtime. Descrever AS-IS e alvo sem pressupor src/modules. C4: pessoas/sistemas → unidades de execução/dados → componentes; monólito modular pode ter muitos componentes.

Para decisão afetada: finalidade/limites, ownership/regras/estados, contratos de request/response/erro/idempotência/versionamento, falhas/recovery e segurança. Outbox PostgreSQL versus Redis fila/cache; capacidade/VPS/retention são hipóteses até medição. Broker/tenant/RLS são propostas posteriores. Avaliar lock writer real, índice/fence e prova de término, não só lock da fila.

Atualizar arquitetura/contratos/módulos/runbooks existentes, ADR pertinente e handoff técnico canônico. Handoff especifica revisão/estado observado/alvo, restrições aprovadas, contratos, dependências, riscos, pendências e critérios para Tech Lead. Não inventar classes, serviços ou eficácia sem teste.
