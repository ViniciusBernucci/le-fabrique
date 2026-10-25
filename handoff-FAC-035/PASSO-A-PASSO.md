# FAC-035 — Passo a passo

Comandos em Git Bash, a partir da **raiz do repositório `le-fabrique`**. Você commita; os agentes nunca commitam.

## 0. Preparar `developer`

```bash
git checkout developer
git pull origin developer
git status --short
```

Se aparecerem arquivos do FAC-033/FAC-034 pendentes, commite-os antes. A worktree nasce do último commit, e o que não estiver commitado fica de fora.

## 1. Criar a worktree

```bash
git worktree add ../le-fabrique-fac-035 -b feat/fac-035-tarefas-scrum developer
cd ../le-fabrique-fac-035
git branch --show-current        # deve ser feat/fac-035-tarefas-scrum
git rev-parse HEAD               # anote o SHA-base no ticket
npm ci
```

## 2. Copiar este pacote para a worktree

Copie a pasta `docs/` deste pacote por cima da `docs/` da worktree. Os caminhos já batem. Depois:

```bash
git add docs/08-desenvolvimento/tickets/FAC-035.md docs/09-entregas/2026/evidencias/FAC-035
git commit -m "docs: ticket FAC-035 e plano de implementação"
```

## 3. Subir o banco de desenvolvimento

```bash
docker compose -f compose.dev.yaml up -d
```

## 4. Sessão 1: contratos, banco e API

```bash
claude
```

Cole o bloco de `docs/09-entregas/2026/evidencias/FAC-035/01-prompt-contratos-api.md`. Ao terminar, o agente lista os arquivos e para.

Aplique a migração e confira:

```bash
npm run db:generate
npm run db:migrate
npm run typecheck
npm test -w @le-fabrique/contracts
npm test -w @le-fabrique/api
npm run lint
```

Se algo falhar, peça a correção na mesma sessão (até 2 rodadas). Com tudo verde:

```bash
git status --short
git add packages/contracts/src apps/api/prisma apps/api/src docs
git status --short               # confira que só entrou o que é do FAC-035
git commit -m "feat: modelo e API de planejamento ágil (FAC-035)"
```

## 5. Sessão 2: frontend

Feche o CLI e abra uma sessão nova (`claude`). Cole o bloco de `02-prompt-web.md`.

Teste no navegador:

```bash
npm run dev
```

Entre com o token, abra Tarefas e confira os 12 critérios do ticket, em especial:
- crie um ticket, recarregue a página e veja se persistiu;
- registre um bloqueio e tente concluir: deve recusar;
- abra o mesmo ticket em duas abas e salve nas duas: a segunda recebe aviso;
- saia da sessão e confirme que Tarefas pede login.

Depois:

```bash
npm run typecheck && npm test -w @le-fabrique/web && npm run build -w @le-fabrique/web && npm run lint
git add apps/web/src docs
git status --short
git commit -m "feat: painel de tarefas Scrum com persistência (FAC-035)"
```

## 6. Sessão 3: revisão independente

Abra uma sessão nova e cole `04-prompt-revisao.md`. Leia `05-revisao.md`. Achados bloqueantes voltam para uma nova sessão de implementação com o texto do achado. Depois de corrigir:

```bash
git add docs/09-entregas/2026/evidencias/FAC-035/05-revisao.md <arquivos corrigidos>
git commit -m "fix: ajustes da revisão do FAC-035"
```

## 7. Integrar em `developer`

```bash
cd ../le-fabrique
git checkout developer
git pull origin developer
git merge --no-ff feat/fac-035-tarefas-scrum
npm ci
npm run db:migrate
npm run build && npm test
git push origin developer
```

## 8. Limpar

```bash
git worktree remove ../le-fabrique-fac-035
git worktree prune
git branch -d feat/fac-035-tarefas-scrum
```

O `-d` só apaga a branch se ela já estiver mergeada. Não use `-D`.

## Se precisar desfazer

Antes do merge, basta remover a worktree e a branch. Depois do merge, use `git revert -m 1 <sha do merge>` e crie uma migração que remova as tabelas `planning_*` (são novas e não afetam dados existentes).
