# Handoff para Tech Lead

## Estado atual

FAC-000 entrega a fundação executável da arquitetura aprovada. O monorepo contém painel React/Vite, API NestJS, worker Node.js, contratos Zod, interfaces de runtime, PostgreSQL/Prisma, Redis/BullMQ e Docker Compose. A implementação está na branch `feat/fac-000-typescript-foundation`, pronta para revisão e ainda sem aceite para DONE.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto futuro de execução de jobs.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas para adapters futuros sem importar implementações ou credenciais.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Revisar e aceitar FAC-000 no SHA exato da entrega.
2. Concluir FAC-001 e FAC-002 com piloto, repositório, baseline e providers elegíveis comprovados.
3. Implementar FAC-003 sobre os contratos e a persistência existentes.
4. Implementar FAC-004 com identidade de serviço e protocolo interno autenticado.
5. Evoluir runtime, contexto, sandbox, orquestração e gates na ordem FAC-005 a FAC-013.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Ainda faltam dispatcher transacional de outbox, idempotência de jobs, leases/fencing, sandbox efetivo, sanitização de logs, autenticação administrativa e do worker, backups restauráveis e adapters validados com clientes oficiais. Esses itens não devem ser inferidos a partir do probe sintético do bootstrap.
