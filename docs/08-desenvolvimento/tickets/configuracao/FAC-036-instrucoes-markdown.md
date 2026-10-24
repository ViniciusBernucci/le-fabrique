# FAC-036 — Arquivos Markdown para agentes e skills

READY autorizado pelo pedido de 2026-10-09 (Europe/Berlin). Base: 38998ebf313625d2202dcb51c574803d78a3a1ef; branch feat/fac-036-instrucoes-md em worktree isolada. Não há outro writer iniciado nesta worktree.

Objetivo: adicionar instruções por arquivo .md nos modais de agentes pré-configurados/personalizados e skills; descrição é somente resumo breve. Disponibilizar download, substituição e persistência versionada. Preservar instruções existentes e separar descrição/conteúdo funcional.

Escopo: apps/web, schemas de configuração em packages/contracts, testes de settings e documentação afetada. Sem mudança de stack, nova dependência, migration, execução automática de perfis, integração/push/deploy ou credenciais. Risco: compatibilidade de leitores strict antigos e integridade do conteúdo Markdown.

Critérios: selecionar .md UTF-8 não vazio e limitado; salvar/reabrir mantém conteúdo e nome; baixar o mesmo conteúdo; erro não substitui arquivo anterior; salvar aguarda leitura; cancelar descarta rascunho; registros antigos continuam válidos. Limites: 16.000 caracteres para agentes e 64.000 para skills; descrição até 500.

Checks: testes web/contratos/settings, typecheck/build/lint pertinente, gate documental. Revisão independente/browser/aceite humano da revisão exata são gates separados. Sem gastos adicionais autorizados.

Estado após implementação: IMPLEMENTADO / AWAITING_HUMAN. [Entrega](../../../09-entregas/2026/2026-10-09-FAC-036-instrucoes-markdown.md).
