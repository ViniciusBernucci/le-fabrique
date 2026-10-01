# Handoff para Tech Lead

## Estado atual

FAC-000 e FAC-002 a FAC-008 estão DONE. O controle possui autenticação administrativa, projetos/tickets, outbox idempotente e orquestracao persistida. O worker tem identidade, heartbeat, probe sintetico de orquestracao, leases, fencing e checkpoints. Runtime Codex, contexto, guard, sandbox e snapshots estao implementados como componentes; sua composicao controlada pertence ao FAC-009. O piloto externo permanece adiado até o núcleo estar pronto.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto futuro de execução de jobs.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas para adapters futuros sem importar implementações ou credenciais.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Executar FAC-009 em branch/worktree proprio, compondo developer, checks e reviewer sem ampliar providers.
2. Preservar checkpoint e quiescencia antes de qualquer nova tentativa ou troca de papel.
3. Evoluir segundo provider e gates na ordem de dependências até FAC-011.
4. Definir manualmente o piloto em FAC-001 e executar o ensaio real em FAC-012.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Ainda faltam a composicao executora do FAC-009, segundo provider/handoff, gate documental automatizado, painel de runs/SSE, rotação/multiusuário, backups restauráveis e piloto real. Sandbox e adapter possuem provas isoladas; isso ainda nao comprova o fluxo completo de um ticket.
