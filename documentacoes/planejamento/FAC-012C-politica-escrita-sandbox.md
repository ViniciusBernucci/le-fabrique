# FAC-012C — Política de escrita do SandboxRunner

Status: READY

## Objetivo

Impedir que comandos executados pelo SandboxRunner alterem o workspace inteiro por padrão. Tornar a árvore somente leitura e reabrir escrita apenas em caminhos explícitos confiáveis, mantendo isolamento de host, limites e quiescência existentes.

## Critérios de aceite

1. Contrato runtime adiciona `writablePaths`, vazio por padrão, com caminhos relativos normalizados, únicos e sem sobreposição.
2. Runner falha antes de iniciar processos se um caminho não existe, contém symlink ou sai da raiz real do workspace.
3. Launcher monta `/mnt` somente leitura e reabre apenas caminhos declarados; o comando não consegue criar/alterar arquivos fora deles.
4. Caminhos exatos de arquivo e diretório funcionam; sistema de arquivos e política de rede/limites atuais permanecem.
5. Testes de integração comprovam escrita permitida, escrita negada, symlink recusado, root readonly, timeout e parada confirmada.
6. Lint, typecheck, testes, build, `git diff --check` e validação do Compose passam.
7. Não ligar o consumer real nem executar cliente/provider.

## Baseline e limites

Base `ce27c13cace1fa81b8bffde1df98e8c3e499fe0e`; branch `feat/fac-012c-sandbox-path-policy`; worktree `/home/vinicius/le-fabrique-fac-012c`. Caminhos: `packages/contracts`, `packages/runtime`, testes e docs de infraestrutura/operação. Sem DB, Redis, checkout externo, deploy, login, migration aplicada ou gasto. Nenhum provider elegível necessário.

## Dependências e limites conhecidos

FAC-007, FAC-009, FAC-012A/B. Este ticket restringe `SandboxRunner`; o processo do CLI Developer ainda precisa aplicar a mesma política antes do consumer real ser ativado.
