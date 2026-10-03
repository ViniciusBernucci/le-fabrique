# FAC-012AD — Estado operacional da fábrica no painel

Status: READY. Data: 2026-10-03. Baseline `8a47bbf` (445 testes + 3 PostgreSQL); branch `feat/fac-012ad-operation-panel`, worktree exclusiva `/home/vinicius/le-fabrique-fac-012ad`, handoff SHA/patch/untracked limpos, nenhum outro writer nela.

Objetivo: mostrar heartbeat atual do executor e bloqueio global do writer no próprio painel, sem exigir projeto/piloto ou inventar disponibilidade de IA. Lacuna: /workers existe, mas UI não mostra workers; ONLINE persistido não prova heartbeat recente nem stop de tentativa expirada.

Escopo: contratos runtime, API read-only autenticada de operação, React painel e cliente, testes contratos/API/web, docs controle/operação/planejamento/lessons e pontos de entrada. Critérios: estado disponível sem projeto; stale/future heartbeat desconhecido; tentativa sem stop permanece bloqueada após lease; índice global ausente visível; erro/requisição pendente não mostram estado saudável antigo; dados minimizados, sem segredo/comando/cliente na API; requests sequenciais canceláveis. Um writer e duas correções máximas. Sem autenticação/IA/gasto/produção/migration/deploy. Rollback reverte feature sem alterar tentativas/artefatos. Aceite exato pendente.
