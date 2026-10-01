# Handoff para Tech Lead

## Estado atual

FAC-000 e FAC-002 a FAC-009 estão DONE. O coordenador de Developer, checks, snapshots e Reviewer foi aceito. O controle possui autenticação administrativa, projetos/tickets, outbox idempotente e orquestracao persistida. O loop BullMQ continua no probe sintetico ate existir perfil local confiavel de repositorio e comandos. FAC-010 deve validar um segundo provider e o handoff sem contornar esse gate. O piloto externo permanece adiado até o núcleo estar pronto.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto futuro de execução de jobs.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas para adapters futuros sem importar implementações ou credenciais.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Validar um segundo cliente oficial antes de implementar seu adapter no FAC-010.
2. Preservar checkpoint e quiescencia antes de qualquer nova tentativa ou troca de papel.
3. Implementar handoff por estado externo, sem transferir sessao privada, e manter perfil operacional bloqueado ate allowlist confiavel.
4. Definir manualmente o piloto em FAC-001 e executar o ensaio real em FAC-012.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Ainda faltam o perfil operacional e a persistencia que ligam o coordenador FAC-009 ao consumer real, segundo provider/handoff, gate documental automatizado, painel de runs/SSE, rotação/multiusuário, backups restauráveis e piloto real. A composicao possui prova sintetica, mas ainda nao comprova um ticket real ponta a ponta.
