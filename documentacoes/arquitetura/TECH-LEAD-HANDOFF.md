# Handoff para Tech Lead

## Estado atual

FAC-000, FAC-002 a FAC-009, FAC-010A/B/C e FAC-011A/B/C estão DONE. FAC-011D implementa PR sob gate humano e aguarda aceite. `gh` ainda nao esta instalado; nenhuma escrita real foi feita. O loop de tickets continua no probe sintetico. FAC-010 aguarda Claude real e o piloto externo permanece adiado.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto futuro de execução de jobs.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas para adapters futuros sem importar implementações ou credenciais.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Revisar e aceitar a revisao exata FAC-011D.
2. Instalar/configurar clientes e repetir preflights reais de Claude e GitHub.
3. Ligar o coordenador FAC-009 ao consumer somente depois de existir perfil local confiavel de repositorio/comandos.
4. Definir manualmente o piloto em FAC-001 e executar o ensaio real em FAC-012.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Ainda faltam instalacao/login/preflights reais, keyring comprovado, prova remota de PR, perfil operacional que liga o coordenador FAC-009 ao consumer, gate documental automatizado, painel de runs/SSE, rotacao/multiusuario, backups restauraveis e piloto real. Adapter Claude e handoff existem como bibliotecas aceitas, mas a composicao possui apenas prova sintetica e ainda nao comprova um ticket real ponta a ponta.
