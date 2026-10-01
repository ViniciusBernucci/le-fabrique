# Perfis de permissao para clientes CLI

## Conceito aplicado

Um sandbox chamado `read-only` pode impedir escrita sem esconder arquivos sensiveis. Isolamento de credenciais exige negar leitura fora do workspace e reabrir somente os caminhos indispensaveis ao runtime.

No FAC-002, o modo legado do Codex permitiu `test -r ~/.codex/auth.json`. A correcao usou um perfil de permissao com `:root = deny`, `:minimal = read`, raiz ativa em leitura ou escrita conforme o cenario e rede de comandos desativada. O canario passou de `AUTH_FILE_READABLE` para `AUTH_FILE_BLOCKED` sem abrir o arquivo.

## Exemplo do repositorio

`scripts/fac-002-codex-preflight.sh` passa o perfil por argumentos separados ao cliente. A fixture de leitura comprova carregamento de regras; a fixture de isolamento testa somente a permissao; a fixture de escrita roda numa copia descartavel sob `.artifacts`.

O cliente confiavel ainda precisa acessar sua autenticacao para falar com o fornecedor. A politica restringe os comandos gerados, que sao a superficie exposta ao codigo do projeto. Cada identidade real de worker deve repetir o teste, pois permissao observada em outro usuario ou container nao prova o ambiente final.

## Limite

Esse perfil nao substitui cgroups, timeout, kill da arvore de processos, worktree isolada ou bloqueio de sockets. Esses controles pertencem aos tickets de runtime e sandbox.

No FAC-010C, o perfil Claude combina `safe-mode`, `restricted`, MCP estrito, browser desligado, sessao nao persistida e prompts de permissao `none`. Read-only expoe apenas leitura/busca; workspace-write acrescenta somente Edit/Write. O ambiente remove tambem token/base URL e seletores AWS/Bedrock/Vertex/Foundry. Como configuracao administrada ainda pode existir fora do processo, elegibilidade exige `authMethod` de assinatura explicitamente reconhecido e `apiProvider=firstParty`; qualquer ambiguidade falha fechado.
