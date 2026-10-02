# FAC-012I — Perfil de execução configurado por projeto

Status: READY

## Objetivo

Adicionar ao setup do projeto o contexto permitido e a allowlist explícita de checks aprovados para execução autônoma. O perfil fica versionado junto à definição do projeto, é copiado ao snapshot READY e consumido pelo compilador; comandos candidatos não aprovados jamais entram no workflow.

## Critérios de aceite

1. Contrato runtime strict mantém `executionProfile: null` para definições antigas até configuração explícita; quando presente, contém fontes de contexto e checks aprovados com estrutura validada.
2. Fontes devem ser únicas, normalizadas, dentro de `allowedPaths` e fora de `forbiddenPaths`; checks aprovados devem corresponder exatamente aos checks candidatos por nome/executável/argv.
3. Interface deixa configurar fontes e marcar/desmarcar aprovação explícita por check; editar nome/comando/argv desmarca a aprovação anterior. Nenhuma conta/modelo de IA é acrescentada nesta tela.
4. READY falha fechado sem perfil, e o snapshot imutável inclui perfil/versão. Alterações posteriores não mudam o job já publicado.
5. `compileWorkflowRequest` compara com o perfil aprovado do snapshot e compila somente checks explicitamente aprovados; check/contexto fora da allowlist falham fechado.
6. Testes de contrato/API/web/worker cobrem leitura legada, validação cruzada, aprovação, edição após aprovação, READY gate e compilação estrita.
7. Lint, typecheck, testes, build e `git diff --check` passam.
8. Sem migration aplicada, consumer/CLI/provider, repo remoto, checkout, banco/fila real, piloto, gastos ou deploy.

## Baseline e limites

Base `0a9a7545dd011f166a233c8e7adc94d6a595ce9f`, branch `feat/fac-012i-project-execution-profile`, worktree `/home/vinicius/le-fabrique-fac-012f`. Escopo: `packages/contracts`, `apps/api/src/control`, `apps/web/src/ProjectDefinitionPanel.tsx`, `apps/worker/src/workflow-compiler.ts` e testes; docs de controle/configuração/runtime/operação e lesson de projeto configurável. Dados de definição já persistem em JSON; nenhuma migration necessária.

## Fora de escopo

Resolver root de checkout local e sincronizar repositórios, fornecer limites/guard operacional do worker, ligar fila, lease/fencing de execução, executar providers ou validar identidade systemd. Esses gates permanecem para tickets seguintes; piloto permanece manual.
