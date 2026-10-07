# Correção e performance — TypeScript/PostgreSQL/Redis

Verificar estados de Ticket/Run/Attempt por código/schema, READY/outbox/claim, validação Zod e limites de bundle. Retry/idempotência, fencing, leases e stopped_confirmed: heartbeat stale não comprova parada. Resultado do workflow AWAITING_HUMAN não é enum persistido de Run. Handoff interno e resume administrativo têm semânticas diferentes.

Em Prisma/Nest: cardinalidade, paginação, selects, transações, índices reais e N+1 fundamentado. Não inventar plano SQL/latência ou impor índice sem inspeção/medição. API não faz execução pesada; worker precisa limites, cancelamento e recuperação.

Em React: estados loading/error/empty, assincronia/races, subscriptions e renderizações custosas demonstráveis. Não exigir memoização ou otimização por dogma. Cobertura de erro/concorrência e testes comprovam risco relevante; compilação não valida comportamento.
