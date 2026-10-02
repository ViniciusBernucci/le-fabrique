# FAC-012G — Workflow com rota configurada por função

Status: READY

## Objetivo

Fazer o `DeveloperWorkflow` consumir o `ConfiguredAgentRouter` para escolher, em cada chamada, o adapter e o modelo configurados na interface para Developer e Reviewer. Hoje o workflow aceita um único adapter/modelo e não usa a rota FAC-012F, então configurações distintas não governam o trabalho executado.

## Critérios de aceite

1. Cada chamada Developer/Reviewer (inclusive novas rodadas de correção) resolve a função no router, sem cache de adapter/modelo no workflow.
2. A execução Developer usa exclusivamente provider/modelo/permissão da rota `DEVELOPER`; Reviewer usa rota própria e exige `READ_ONLY`.
3. O guard contabiliza tentativas e falhas usando o provider realmente roteado; falha de resolução interrompe antes de executar adapter.
4. Testes usam routers/adapters sintéticos e comprovam providers/modelos distintos, mudança de configuração entre tentativas, Reviewer read-only e falha fechada sem execução.
5. Contratos públicos e fluxo de fila permanecem inalterados; `main.ts` continua no probe, sem instanciar workflow, cliente CLI, checkout, DB ou fila real.
6. Lint, typecheck, testes, build e `git diff --check` passam.

## Baseline e limites

Base `dd4e3d35428d690503787980b0da7ea57b1a64b8`, branch `feat/fac-012g-role-aware-workflow`, worktree atual `/home/vinicius/le-fabrique-fac-012f`. Alvos: `apps/worker/src/developer-workflow.ts` e testes. Reutilizar router FAC-012F e contratos existentes; sem nova dependência, migration, chamada de provider ou configuração de conta real.

## Fora de escopo

Conectar consumer BullMQ, materializar checkout/perfil operacional confiável, executar cliente/provider, login/preflight de identidade de serviço, custos e escolha do piloto externo. O consumer permanece desligado da execução autônoma.
