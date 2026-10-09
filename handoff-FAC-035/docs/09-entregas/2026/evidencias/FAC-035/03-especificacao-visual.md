# FAC-035 — Especificação visual

Protótipo: `design/Tarefas Scrum.dc.html` (abrir no navegador com `support.js` na mesma pasta). Este documento traduz o protótipo para os tokens de `apps/web/src/theme-hud.css`.

## Princípios

Interface de trabalho limpa: sem grade de fundo, sem glow, sem fonte display nos cards. Contraste com o dashboard inicial é intencional. Fonte UI `--hud-font-ui`; códigos, pontos e datas em `--hud-font-mono`.

## Cores semânticas

| Uso | Token |
|---|---|
| Fundo da página | `--hud-bg` |
| Coluna/painel | `--hud-surface-solid` com borda `--hud-line-soft` |
| Card | `--hud-node-bg`, borda `--hud-line-soft`, raio `--hud-radius` |
| Texto título / corpo / secundário | `--hud-text-strong` / `--hud-text` / `--hud-text-muted` |
| Ação primária | fundo `--hud-cyan`, texto `--hud-ink` |
| Status A fazer · Em andamento · Revisão · QA · Concluído | `--hud-text-muted` · `--hud-blue` · `--hud-violet` · `--hud-cyan` · `--hud-teal` |
| Tipo História · Tarefa · Bug · Spike (glifo H/T/B/S) | `--hud-teal` · `--hud-cyan` · `--hud-rose` · `--hud-violet` |
| Prioridade Crítica · Alta · Média · Baixa | `--hud-rose` · `--hud-amber` · `--hud-cyan` · `--hud-text-muted` |
| Bloqueio / Dúvida | `--hud-rose` / `--hud-amber` (borda do card na cor, etiqueta com fundo a ~11% de opacidade) |
| Épico | cor própria (`color` do épico), usada só no ponto de 6px e na barra de progresso |

## Estrutura

1. **Cabeçalho**: título "Tarefas", seletor de projeto, botão "+ Novo ticket".
2. **Faixa da sprint ativa**: nome, período, dias restantes, objetivo, barra de progresso (pontos concluídos / total) e chips de impedimento (n bloqueados, n dúvidas) que funcionam como filtro.
3. **Abas** segmentadas: Quadro da sprint · Backlog · Épicos. Aba ativa com fundo `--hud-cyan`.
4. **Filtros** em uma linha que quebra: busca, avatares de responsável (clique filtra), tipo, prioridade, épico, "Agrupar: Nenhum/Épico", "Limpar filtros" quando houver filtro.
5. **Quadro**: 5 colunas `repeat(5, minmax(0,1fr))`, gap 12px; cabeçalho da coluna com ponto da cor do status, nome, contagem e soma de pontos. Com agrupamento, uma raia por épico com rótulo.
6. **Card**: linha 1 glifo do tipo (18px, borda na cor do tipo) + código mono + prioridade mono à direita; linha 2 título (600, 15px, `text-wrap: pretty`); linha 3 ponto+nome do épico, contador de subtarefas `2/4`, pontos, avatar. Etiqueta de impedimento acima do título quando houver.
7. **Backlog**: grupos por sprint (Sprint ativa, planejadas, "Backlog" para `sprintId=null`), cabeçalho com estado, contagem e pontos; linhas em grid `20px 74px minmax(0,1fr) 170px 120px 64px 34px 26px` (tipo, código, título, épico, status, prioridade, pontos, avatar).
8. **Épicos**: lista expansível; cabeçalho com código, nome, contagem, barra de progresso por pontos e percentual; filhos indentados 44px.
9. **Drawer do ticket** (lateral direita, ~880px, rolagem interna própria): coluna principal (título editável, especificação, critérios marcáveis, subtarefas marcáveis, bloqueado por, atividade/comentários) + coluna lateral 230px (status, responsável, prioridade, tipo, story points, épico, sprint, prazo, labels, relator, criado em, Definition of Done). Topo: código, selo de origem ("Gerado por {agente} · IA" em `--hud-cyan`, "Criado manualmente" em `--hud-text-muted`, "Editado manualmente" quando aplicável), botões Registrar bloqueio / Registrar dúvida. Impedimento ativo: caixa com borda da cor, motivo, autor·data e botão Resolver.

## Avatares

Agente: quadrado raio 4px, iniciais mono. Humano: círculo. 22px nos cards, 28px no drawer.

## Estados

- Vazio de coluna: "Nenhum ticket" em `--hud-text-dim`.
- Carregando: esqueleto das colunas, sem spinner central.
- Erro de carga: mensagem com botão "Tentar novamente".
- Foco visível: `--hud-focus` em todos os controles.
