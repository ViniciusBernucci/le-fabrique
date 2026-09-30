# Handoff para Tech Lead

## Estado atual

FAC-000 e FAC-003 estão DONE. O controle possui autenticação administrativa, projetos/tickets e outbox idempotente. FAC-004 implementou identidade persistida, registro e heartbeat autenticado do worker no SHA `6d73041bdcbd50215b6a018c9937475c29f542b1` e aguarda revisão. O piloto externo permanece adiado até o núcleo estar pronto.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto futuro de execução de jobs.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas para adapters futuros sem importar implementações ou credenciais.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Revisar e aceitar FAC-004 na revisão exata.
2. Executar FAC-002 em cenário sintético e comprovar ao menos um cliente oficial elegível antes do FAC-005.
3. Evoluir runtime, contexto, sandbox, orquestração e gates na ordem de dependências até FAC-011.
4. Definir manualmente o piloto em FAC-001 e executar o ensaio real em FAC-012.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Ainda faltam dispatcher da outbox, idempotência de jobs, claim, leases/fencing, sandbox efetivo, sanitização completa de logs, rotação/multiusuário, backups restauráveis e adapters validados com clientes oficiais. Esses itens não devem ser inferidos a partir do registro e heartbeat sintéticos.
