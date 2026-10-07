# Recuperar falhas e restaurar

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## Comportamento e usuário

Crash/reboot/lease/restore preservam trabalho e ownership sem dois writers. Usuário: responsável autorizado do projeto; administração tem identidade separada.

## Regras e critérios de aceite

Restore ensaiado; RPO/RTO medidos; órfãos reconciliados; código hostil não liberado só pelo piloto. Todos são critérios planejados; não há evidência de execução no espelho.

## Módulos e contratos

[Worker](../03-modulos/worker/README.md); [Executor Manager](../03-modulos/executor-manager/README.md); [Orchestrator](../03-modulos/orchestrator/README.md); [Sandbox](../03-modulos/sandbox/README.md). Contratos detalhados estão no [catálogo](../05-contratos/README.md); fluxos no [capítulo de fluxos](../02-arquitetura/fluxos.md).

## Rastreabilidade e limites

Backlog relacionado: FAC-012; LF-MT-09/11. IDs originais preservados; estes arquivos não criam novos FAC nem afirmam entrega. Release/código/revisão/testes: não disponíveis. Implementação deverá ligar registro de entrega e evidências reais.
