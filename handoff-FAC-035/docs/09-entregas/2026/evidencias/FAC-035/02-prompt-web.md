# Sessão 2 — Frontend (apps/web)

Abra uma **sessão nova** do Claude CLI na raiz da worktree, depois que a sessão 1 estiver commitada.

```text
Você é o implementador do ticket FAC-035, sessão 2 de 2 (frontend).

PREPARAÇÃO — antes de ler código
1. `git branch --show-current` deve ser `feat/fac-035-tarefas-scrum`. Senão, PARE.
2. `git status --short` deve estar limpo. Senão, PARE e avise.
3. Confirme que existem: packages/contracts/src/planning.ts (exportado no index.ts) e apps/api/src/planning/planning.controller.ts. Se faltar, PARE — não recrie.

LEITURA OBRIGATÓRIA (integral)
- CLAUDE.md, AGENTS.md, as duas políticas em docs/00-governanca/, skills/00-perfil-la-fabrique.md, skills/implementador-de-ticket/SKILL.md
- docs/08-desenvolvimento/tickets/FAC-035.md
- docs/09-entregas/2026/evidencias/FAC-035/00-plano.md (contrato e endpoints)
- docs/09-entregas/2026/evidencias/FAC-035/03-especificacao-visual.md (layout, cores, componentes — fonte da verdade visual)
- docs/09-entregas/2026/evidencias/FAC-035/design/Tarefas Scrum.dc.html (protótipo de referência; leia o template e a classe Component para comportamento; NÃO copie o formato DC nem estilos inline)
- packages/contracts/src/planning.ts
- Referência read-only: apps/web/src/App.tsx, DashboardLayout.tsx, control-api.ts, SettingsModal.tsx, theme-hud.css, poll-resource.ts, TasksPanel.tsx/tasks-model.ts/tasks.css e seus specs atuais

TAREFA 1 — Cliente da API
Em apps/web/src/control-api.ts, adicionar uma função por endpoint do plano (getPlanning, createEpic, updateEpic, createSprint, updateSprint, createPlanningItem, updatePlanningItem, movePlanningItemStatus, setImpediment, clearImpediment, listActivity, addComment), no mesmo padrão das existentes, validando a resposta com o schema do contrato. Erro 409 deve ser distinguível (ex.: classe ConflictError) para a UI tratar.

TAREFA 2 — Modelo de visão
Reescrever apps/web/src/tasks-model.ts como funções puras sobre os tipos do contrato: rótulos PT (História/Tarefa/Bug/Spike; A fazer/Em andamento/Revisão/QA/Concluído; Crítica/Alta/Média/Baixa; Bloqueio/Dúvida), filtro, agrupamento por coluna/épico/sprint, soma de pontos, progresso por épico, contadores de impedimento. Remover demoOnboarding, removeExamples, assignAutomatically, TASKS_STORAGE_KEY e todo uso de localStorage para dados. Reescrever tasks-model.spec.ts.

TAREFA 3 — Painel
Reescrever apps/web/src/TasksPanel.tsx (pode dividir em TaskBoard.tsx, TaskBacklog.tsx, TaskEpics.tsx, TaskDrawer.tsx se ficar >400 linhas) e apps/web/src/tasks.css seguindo a especificação visual, usando apenas variáveis --hud-* existentes em theme-hud.css. Sem grade de fundo, sem glow. Comportamento:
- Seletor de projeto (projetos já vindos de App.tsx); carrega GET planning do projeto; recarrega após cada escrita.
- Abas Quadro da sprint / Backlog / Épicos; filtros; chips de impedimento; agrupamento por épico no quadro.
- Drawer do item: todos os campos editáveis, critérios e subtarefas marcáveis, adicionar critério/subtarefa, bloqueado por, registrar/resolver impedimento com motivo obrigatório, comentários, histórico (listActivity), selo de origem, Definition of Done via isDefinitionOfDone.
- 409: mensagem "Este ticket mudou em outra sessão. Recarregue para continuar." com botão Recarregar; nunca reenviar automaticamente. 409 de DONE bloqueado: "Remova o bloqueio antes de concluir".
- Sem token: tela com "Entre com o token administrativo para ver as tarefas" e botão que leva ao login existente; nenhuma requisição.
- Responsáveis: agentes de getFactorySettings filtrados por projeto e enabled (avatar quadrado) + Operador (avatar redondo).
Ajustar App.tsx só no necessário para passar token/projetos. O item "Tarefas" do menu já existe em DashboardLayout — não duplicar.
Reescrever TasksPanel.spec.tsx cobrindo os critérios 1, 3, 4, 6, 11 e 12 com a API mockada.

FORA DO ESCOPO
apps/api, packages/contracts (exceto se encontrar bug: PARE e avise), worker/runtime, drag-and-drop, exclusão, dependências npm novas, mudanças no dashboard inicial.

CHECKS
npm run typecheck
npm test -w @le-fabrique/web
npm run build -w @le-fabrique/web
npx biome check apps/web/src
python3 scripts/validar-documentacao.py

DOCUMENTAÇÃO
Acrescentar a seção "Sessão 2" em docs/09-entregas/2026/2026-10-09-FAC-035-tarefas-scrum.md; atualizar o capítulo de feature de Tarefas em docs/04-features/ (se existir; senão criar seguindo a política), a linha FAC-035 em docs/08-desenvolvimento/09-backlog.md como IMPLEMENTADO / AWAITING_HUMAN e docs/04-CHANGELOG.md. Browser interativo: registrar NOT_RUN se não executado.

GIT
Não faça commit, push, merge nem stash. Ao final, mostre `git status --short` e a lista exata de arquivos para o usuário commitar, e PARE.
```
