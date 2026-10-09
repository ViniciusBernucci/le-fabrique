# Sessão 1 — Contratos, Prisma e API

Cole o bloco abaixo no Claude CLI aberto na raiz da worktree `../le-fabrique-fac-035`.

```text
Você é o implementador do ticket FAC-035, sessão 1 de 2 (contratos + banco + API).

PREPARAÇÃO — antes de ler código
1. Rode `git branch --show-current`. Tem que ser `feat/fac-035-tarefas-scrum`. Se for outra, PARE e avise.
2. Rode `git status --short`. Se houver alteração que não é deste ticket, PARE e avise.

LEITURA OBRIGATÓRIA (integral, nesta ordem)
- CLAUDE.md, AGENTS.md
- docs/00-governanca/01-POLITICA-IA.md e docs/00-governanca/02-POLITICA-DOCUMENTACAO.md
- skills/00-perfil-la-fabrique.md e skills/implementador-de-ticket/SKILL.md
- docs/08-desenvolvimento/tickets/FAC-035.md (escopo, critérios, limites)
- docs/09-entregas/2026/evidencias/FAC-035/00-plano.md (modelo, contrato, endpoints, regras — fonte da verdade desta sessão)
- Referência read-only: apps/api/prisma/schema.prisma, apps/api/src/control/* (padrão de controller/service/guard/parse), apps/api/src/settings/settings.service.ts (leitura de digitalAgents), packages/contracts/src/index.ts e *.spec.ts, uma migração existente em apps/api/prisma/migrations/ (formato SQL)
Registre no relato os paths lidos.

TAREFA 1 — Contrato
Criar packages/contracts/src/planning.ts conforme a seção "Contrato" do plano, com zod (mesma versão/estilo do index.ts). Exportar pelo index.ts. Criar packages/contracts/src/planning.spec.ts cobrindo: limites de campos, storyPoints fora da lista rejeitado, endDate < startDate rejeitado, isDefinitionOfDone (verdadeiro só com critérios>0, tudo marcado e sem impedimento).

TAREFA 2 — Prisma
Acrescentar ao schema.prisma os enums e models da seção "Modelo de dados" e as relações inversas em Project. Não alterar nenhum outro model. Criar a pasta de migração apps/api/prisma/migrations/20261009000100_fac_035_planning/migration.sql escrita à mão, compatível com o schema, incluindo o índice parcial planning_sprints_one_active. Pode rodar `npm run db:generate`. NÃO rode db:migrate, db:deploy nem nada que conecte ao banco.

TAREFA 3 — Módulo planning
Criar apps/api/src/planning/ com planning.module.ts, planning.controller.ts, planning.service.ts e planning.service.spec.ts, registrando PlanningModule em app.module.ts. Seguir exatamente o padrão do ControlController (AdminAuthGuard, parse com safeParse → BadRequestException, resposta validada pelo schema do contrato). Implementar todos os endpoints da tabela do plano e as regras de negócio 1–6. Conflitos (versão, sprint ativa, DONE com BLOCKER) → ConflictException. Inexistente → NotFoundException. Toda escrita em item numa transação: atualiza, version+1, insere PlanningActivity LOG com texto em português descrevendo a mudança, e editedManually=true quando origin=AGENT. Converter linhas do banco para o shape do contrato numa função única (toPlanningItem).
Testes no estilo dos specs existentes da API, cobrindo: critérios 3, 5, 7, 8, 9, 10 do ticket e geração de number/code.

CRITÉRIOS DESTA SESSÃO
Os critérios 2, 3, 5, 7, 8, 9 e 10 do ticket devem estar cobertos por teste de service. Os demais são da sessão 2.

FORA DO ESCOPO
apps/web, apps/worker, packages/runtime, Ticket/Run/outbox, endpoint para worker/agentes (FAC-036), exclusão de itens, cadastro de pessoas, dependências npm novas, alterar migrações existentes.

CHECKS (rodar e registrar resultado)
npm run typecheck
npm test -w @le-fabrique/contracts
npm test -w @le-fabrique/api
npx biome check packages/contracts/src apps/api/src apps/api/prisma

DOCUMENTAÇÃO
- Criar docs/09-entregas/2026/2026-10-09-FAC-035-tarefas-scrum.md a partir de docs/00-governanca/templates/08-ENTREGA.md, seção "Sessão 1", com paths lidos, arquivos alterados, checks e NOT_RUN (migração não aplicada).
- Atualizar o contrato em docs/05-contratos/ se houver capítulo de API correspondente; caso contrário, criar seguindo a política de ordem didática.

GIT
Não faça commit, push, merge nem stash. Ao final, mostre `git status --short` e a lista exata de arquivos para o usuário commitar, e PARE.
```
