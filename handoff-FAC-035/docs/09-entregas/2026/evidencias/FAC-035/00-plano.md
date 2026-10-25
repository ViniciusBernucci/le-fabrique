# FAC-035 — Plano de implementação

Ticket: [FAC-035](../../../../08-desenvolvimento/tickets/FAC-035.md) · 2026-10-09 · monorepo `le-fabrique`, base `developer`.

## Topologia

Uma worktree, um writer por vez, três sessões sequenciais (contrato compartilhado impede paralelismo):

| Sessão | Prompt | Escopo | Quem commita |
|---|---|---|---|
| 1 | `01-prompt-contratos-api.md` | contracts + Prisma + API | usuário |
| 2 | `02-prompt-web.md` | apps/web | usuário |
| 3 | `04-prompt-revisao.md` | revisão independente, sem edição | — |

Worktree: `../le-fabrique-fac-035` · branch `feat/fac-035-tarefas-scrum` · derivada de `developer` local atualizado.

## Modelo de dados (Prisma, tabelas novas)

```prisma
enum PlanningItemType      { STORY TASK BUG SPIKE }
enum PlanningItemStatus    { TODO IN_PROGRESS REVIEW QA DONE }
enum PlanningPriority      { CRITICAL HIGH MEDIUM LOW }
enum PlanningOrigin        { AGENT MANUAL }
enum PlanningActorKind     { AGENT HUMAN }
enum PlanningImpediment    { BLOCKER QUESTION }
enum PlanningSprintState   { PLANNED ACTIVE CLOSED }
enum PlanningActivityKind  { LOG COMMENT }

model PlanningEpic {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @db.Uuid @map("project_id")
  code      String                     // EP-01, sequencial por projeto
  name      String
  color     String?                    // #rrggbb
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Restrict)
  items     PlanningItem[]
  @@unique([projectId, code])
  @@map("planning_epics")
}

model PlanningSprint {
  id        String              @id @default(uuid()) @db.Uuid
  projectId String              @db.Uuid @map("project_id")
  name      String
  goal      String?
  startDate DateTime            @db.Date @map("start_date")
  endDate   DateTime            @db.Date @map("end_date")
  state     PlanningSprintState @default(PLANNED)
  createdAt DateTime            @default(now()) @map("created_at")
  updatedAt DateTime            @updatedAt @map("updated_at")
  project   Project             @relation(fields: [projectId], references: [id], onDelete: Restrict)
  items     PlanningItem[]
  @@index([projectId, state])
  @@map("planning_sprints")
}
// Na migração SQL, acrescentar índice parcial:
// CREATE UNIQUE INDEX planning_sprints_one_active ON planning_sprints(project_id) WHERE state = 'ACTIVE';

model PlanningItem {
  id                 String              @id @default(uuid()) @db.Uuid
  projectId          String              @db.Uuid @map("project_id")
  number             Int                                      // código exibido: T-{number}
  type               PlanningItemType
  title              String
  specification      String              @default("")
  status             PlanningItemStatus  @default(TODO)
  priority           PlanningPriority    @default(MEDIUM)
  storyPoints        Int?                @map("story_points")
  epicId             String?             @db.Uuid @map("epic_id")
  sprintId           String?             @db.Uuid @map("sprint_id")   // null = backlog
  assigneeKind       PlanningActorKind?  @map("assignee_kind")
  assigneeId         String?             @map("assignee_id")
  reporterKind       PlanningActorKind   @map("reporter_kind")
  reporterId         String              @map("reporter_id")
  origin             PlanningOrigin
  editedManually     Boolean             @default(false) @map("edited_manually")
  labels             String[]            @default([])
  dueDate            DateTime?           @db.Date @map("due_date")
  criteria           Json                @default("[]")   // [{text, done}]
  subtasks           Json                @default("[]")   // [{text, done}]
  impedimentKind     PlanningImpediment? @map("impediment_kind")
  impedimentReason   String?             @map("impediment_reason")
  impedimentByKind   PlanningActorKind?  @map("impediment_by_kind")
  impedimentById     String?             @map("impediment_by_id")
  impedimentAt       DateTime?           @map("impediment_at")
  version            Int                 @default(1)
  createdAt          DateTime            @default(now()) @map("created_at")
  updatedAt          DateTime            @updatedAt @map("updated_at")
  project            Project             @relation(fields: [projectId], references: [id], onDelete: Restrict)
  epic               PlanningEpic?       @relation(fields: [epicId], references: [id], onDelete: SetNull)
  sprint             PlanningSprint?     @relation(fields: [sprintId], references: [id], onDelete: SetNull)
  blockedBy          PlanningDependency[] @relation("blocked")
  blocking           PlanningDependency[] @relation("blocker")
  activity           PlanningActivity[]
  @@unique([projectId, number])
  @@index([projectId, sprintId, status])
  @@map("planning_items")
}

model PlanningDependency {
  itemId      String       @db.Uuid @map("item_id")
  blockerId   String       @db.Uuid @map("blocker_id")
  item        PlanningItem @relation("blocked", fields: [itemId], references: [id], onDelete: Cascade)
  blocker     PlanningItem @relation("blocker", fields: [blockerId], references: [id], onDelete: Cascade)
  @@id([itemId, blockerId])
  @@map("planning_dependencies")
}

model PlanningActivity {
  id        String               @id @default(uuid()) @db.Uuid
  itemId    String               @db.Uuid @map("item_id")
  actorKind PlanningActorKind    @map("actor_kind")
  actorId   String               @map("actor_id")
  kind      PlanningActivityKind
  text      String
  createdAt DateTime             @default(now()) @map("created_at")
  item      PlanningItem         @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@index([itemId, createdAt])
  @@map("planning_activity")
}
```

`Project` ganha as relações inversas `planningEpics`, `planningSprints`, `planningItems`. Nenhuma outra tabela muda.

## Contrato (`packages/contracts/src/planning.ts`, exportado no `index.ts`)

- Constantes: `planningItemTypes`, `planningItemStatuses`, `planningPriorities`, `storyPointValues = [1,2,3,5,8,13,21]`, `planningSprintStates`, `planningImpediments`, `planningActorKinds`, `planningOrigins`.
- `OPERATOR_ACTOR = { kind: "HUMAN", id: "operator" }` — único humano até existir cadastro de pessoas.
- `actorRefSchema = { kind, id: string 1..120 }`
- `checklistItemSchema = { text: trim 1..1000, done: boolean }`
- `planningEpicSchema = { id, projectId, code, name 1..120, color: /^#[0-9a-f]{6}$/i | null, createdAt, updatedAt }`
- `planningSprintSchema = { id, projectId, name 1..80, goal ≤500 | null, startDate, endDate (YYYY-MM-DD, end ≥ start), state, createdAt, updatedAt }`
- `impedimentSchema = { kind, reason trim 1..1000, by: actorRef, at: iso datetime }`
- `planningItemSchema = { id, projectId, number, code ("T-"+number), type, title trim 1..160, specification ≤8000, status, priority, storyPoints: storyPointValues | null, epicId | null, sprintId | null, assignee: actorRef | null, reporter: actorRef, origin, editedManually, labels: string 1..40 [≤10], dueDate | null, criteria: checklist[≤20], subtasks: checklist[≤50], impediment | null, blockedBy: uuid[], version, createdAt, updatedAt }`
- `planningActivitySchema = { id, itemId, actor: actorRef, kind: LOG|COMMENT, text 1..2000, createdAt }`
- `planningSnapshotSchema = { epics[], sprints[], items[] }`
- Inputs: `createEpicSchema {name, color?}`, `updateEpicSchema {name?, color?}`, `createSprintSchema {name, goal?, startDate, endDate}`, `updateSprintSchema {name?, goal?, startDate?, endDate?, state?}`, `createPlanningItemSchema` (campos editáveis; `type`, `title` obrigatórios), `updatePlanningItemSchema` (parcial dos editáveis + `version` obrigatório), `moveStatusSchema {status, version}`, `setImpedimentSchema {kind, reason, version}`, `clearImpedimentSchema {version}`, `commentSchema {text}`.
- Helper puro: `isDefinitionOfDone(item) = criteria.length>0 && todos done && subtasks todos done && impediment === null`.

## Endpoints (AdminAuthGuard, mesmo padrão de `ControlController`)

| Verbo | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `projects/:projectId/planning` | — | `planningSnapshot` |
| POST | `projects/:projectId/planning/epics` | createEpic | 201 epic |
| PATCH | `planning/epics/:epicId` | updateEpic | epic |
| POST | `projects/:projectId/planning/sprints` | createSprint | 201 sprint |
| PATCH | `planning/sprints/:sprintId` | updateSprint | sprint · 409 se ativar com outra ativa |
| POST | `projects/:projectId/planning/items` | createPlanningItem | 201 item (`origin=MANUAL`, `reporter=OPERATOR_ACTOR`) |
| PATCH | `planning/items/:itemId` | updatePlanningItem | item · 409 versão |
| PATCH | `planning/items/:itemId/status` | moveStatus | item · 409 versão ou DONE com BLOCKER |
| PUT | `planning/items/:itemId/impediment` | setImpediment | item |
| DELETE | `planning/items/:itemId/impediment` | clearImpediment | item |
| GET | `planning/items/:itemId/activity` | — | activity[] (mais recente primeiro) |
| POST | `planning/items/:itemId/comments` | comment | 201 activity |

Erros: 400 payload/regra (ciclo, projeto divergente, agente inválido, pontos fora da lista), 404 inexistente, 409 versão/sprint ativa/DONE bloqueado. Toda escrita em item: `version+1`, uma linha `LOG` em `planning_activity` na mesma transação, e `editedManually=true` se `origin=AGENT`.

## Regras de negócio

1. `number` = `max(number)+1` por projeto dentro da transação; em conflito de unique, repetir até 3 vezes.
2. `epic.code` = `EP-` + 2 dígitos sequencial por projeto, mesma estratégia.
3. Epic, sprint e blockers devem pertencer ao mesmo projeto do item.
4. Responsável agente: id existente em `FactorySettings.configuration.digitalAgents`, `enabled`, mesmo `projectId`. Humano: só `operator`.
5. Ciclo em `blockedBy` detectado por busca no grafo do projeto antes de gravar.
6. Sprint `CLOSED` não recebe itens novos (400).

## Sequência de integração

1. Sessão 1 → usuário aplica migração no banco dev, roda checks, commita.
2. Sessão 2 (nova sessão) → usuário valida no navegador, commita.
3. Sessão 3 (nova sessão, sem edição) → achados; correções voltam à sessão 1 ou 2 (até 2 rodadas).
4. Usuário integra em `developer` e remove a worktree.

## Riscos

- Migração nova exige `npm run db:migrate` antes de subir a API, inclusive em outros ambientes.
- FAC-033/FAC-034 em AWAITING_HUMAN: o diff da sessão 2 substitui a demonstração do FAC-033. Confirmar que ambos estão commitados em `developer` antes de criar a worktree.
- Agentes vêm de `FactorySettings` (JSON); agente removido depois deixa `assigneeId` órfão — UI mostra "Agente indisponível".
