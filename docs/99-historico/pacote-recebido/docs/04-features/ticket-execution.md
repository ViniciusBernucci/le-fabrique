# Executar ticket até aceite

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## Comportamento e usuário

Ticket delimitado gera Run, checks, revisão, docs e aceite por revisão. Usuário: responsável autorizado do projeto; administração tem identidade separada.

## Regras e critérios de aceite

Critérios verificáveis; dispatch idempotente; revisão independente; docs corretas; nenhuma promoção automática a DONE. Todos são critérios planejados; não há evidência de execução no espelho.

## Módulos e contratos

[Projects](../03-modulos/projects/README.md); [Tickets](../03-modulos/tickets/README.md); [Runs e Attempts](../03-modulos/runs/README.md); [Orchestrator](../03-modulos/orchestrator/README.md); [Worker](../03-modulos/worker/README.md); [Documentation Gate](../03-modulos/documentation-gate/README.md); [Approvals](../03-modulos/approvals/README.md). Contratos detalhados estão no [catálogo](../05-contratos/README.md); fluxos no [capítulo de fluxos](../02-arquitetura/fluxos.md).

## Rastreabilidade e limites

Backlog relacionado: FAC-003–009/011; LF-MT-00–10. IDs originais preservados; estes arquivos não criam novos FAC nem afirmam entrega. Release/código/revisão/testes: não disponíveis. Implementação deverá ligar registro de entrega e evidências reais.
