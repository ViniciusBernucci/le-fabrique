# Trocar provider sem perder trabalho

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## Comportamento e usuário

Limite/falha interrompe writer e outro provider do mesmo tenant retoma checkpoint recuperável. Usuário: responsável autorizado do projeto; administração tem identidade separada.

## Regras e critérios de aceite

Patch e untracked preservados; quiescência externa; fencing antigo rejeitado; sem fallback entre tenants/API. Todos são critérios planejados; não há evidência de execução no espelho.

## Módulos e contratos

[Provider Manager e Router](../03-modulos/providers/README.md); [Provider Runtime](../03-modulos/runtime/README.md); [Orchestrator](../03-modulos/orchestrator/README.md); [Sandbox](../03-modulos/sandbox/README.md). Contratos detalhados estão no [catálogo](../05-contratos/README.md); fluxos no [capítulo de fluxos](../02-arquitetura/fluxos.md).

## Rastreabilidade e limites

Backlog relacionado: FAC-010; LF-MT-08/09. IDs originais preservados; estes arquivos não criam novos FAC nem afirmam entrega. Release/código/revisão/testes: não disponíveis. Implementação deverá ligar registro de entrega e evidências reais.
