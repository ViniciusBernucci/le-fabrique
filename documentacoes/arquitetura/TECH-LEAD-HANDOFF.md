# Handoff para Tech Lead

## Estado atual

FAC-000, FAC-002 a FAC-009, FAC-010A/B/C, FAC-011 e FAC-011A estão DONE. O controle possui autenticação administrativa, projetos/tickets, outbox idempotente, orquestracao persistida e configuracao versionada de contas/modelos/funcoes/GitHub sem segredos. FAC-011A adiciona verificacao GitHub CLI aceita; o binario `gh` ainda nao esta instalado. O loop BullMQ de tickets continua no probe sintetico ate existir perfil local confiavel de repositorio e comandos. FAC-010 aguarda preflight Claude real futuro. O piloto externo permanece adiado até o núcleo estar pronto.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto futuro de execução de jobs.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas para adapters futuros sem importar implementações ou credenciais.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Implementar FAC-011B, login GitHub oficial iniciado pelo painel, sem segredo em browser/API/banco.
2. Implementar criacao de PR sob gate humano em ticket separado.
3. Instalar/configurar clientes pela operacao futura e repetir os preflights reais de Claude e GitHub.
4. Ligar o coordenador FAC-009 ao consumer somente depois de existir perfil local confiavel de repositorio/comandos.
5. Definir manualmente o piloto em FAC-001 e executar o ensaio real em FAC-012.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Ainda faltam login GitHub gerenciado, instalacao/preflights reais, criacao de PR, perfil operacional que liga o coordenador FAC-009 ao consumer, gate documental automatizado, painel de runs/SSE, rotação/multiusuário, backups restauráveis e piloto real. Adapter Claude e handoff existem como bibliotecas aceitas, mas a composicao possui apenas prova sintetica e ainda nao comprova um ticket real ponta a ponta.
