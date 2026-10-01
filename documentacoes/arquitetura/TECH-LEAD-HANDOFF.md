# Handoff para Tech Lead

## Estado atual

FAC-000 e FAC-002 a FAC-009 estão DONE. FAC-011 implementa o Centro de Configuracoes e aguarda aceite. O controle possui autenticação administrativa, projetos/tickets, outbox idempotente, orquestracao persistida e configuracao versionada de contas/modelos/funcoes/GitHub sem segredos. O loop BullMQ continua no probe sintetico ate existir perfil local confiavel de repositorio e comandos. FAC-010 esta WAITING_PROVIDER porque Claude Code e Antigravity estao deslogados. O piloto externo permanece adiado até o núcleo estar pronto.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto futuro de execução de jobs.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas para adapters futuros sem importar implementações ou credenciais.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Revisar e aceitar a revisao exata FAC-011.
2. Implementar no software o onboarding que inicia login oficial no worker, sem segredo em browser/API/banco, e repetir o preflight FAC-010.
3. Preservar checkpoint e quiescencia antes de qualquer nova tentativa ou troca de papel.
4. Implementar handoff por estado externo, sem transferir sessao privada, e manter perfil operacional bloqueado ate allowlist confiavel.
5. Definir manualmente o piloto em FAC-001 e executar o ensaio real em FAC-012.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Ainda faltam onboarding/login gerenciado, reconciliacao do estado desejado com o cliente real, perfil operacional que liga o coordenador FAC-009 ao consumer, segundo provider/handoff, gate documental automatizado, painel de runs/SSE, rotação/multiusuário, backups restauráveis e piloto real. A composicao possui prova sintetica, mas ainda nao comprova um ticket real ponta a ponta.
