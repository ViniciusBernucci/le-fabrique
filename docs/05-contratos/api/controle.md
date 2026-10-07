# API de controle implementada

Base: a2cc5e0. Fonte de schemas: [packages/contracts/src/index.ts](../../../packages/contracts/src/index.ts); prefixo global `/api`. Consumers: painel e operador administrativo. Auth: Bearer ADMIN_API_TOKEN validado por AdminAuthGuard; token do worker não equivale ao administrativo. Sem membership/grants/tenant implementados.

## Requests, responses e efeitos

| Operação | Request e response canônicos | Efeito / concorrência |
|---|---|---|
| POST /api/projects | createProjectSchema → projectSchema | Cria Project; não clona nem valida acesso real ao repo |
| GET /api/projects | sem body → projectListSchema | Leitura administrativa |
| PATCH /api/projects/:id/base-revision | updateProjectBaseRevisionSchema → projectSchema | expectedBaseRef + baseRevision SHA exato; comparação otimista |
| GET /api/projects/:id/definition | projectDefinitionStateSchema | definition nullable, sem default sintético |
| PUT /api/projects/:id/definition | putProjectDefinitionSchema → projectDefinitionSchema | expectedVersion=0 na criação, versão positiva no update; preserva JSON validado |
| POST/GET /api/projects/:id/tickets | createTicketSchema / ticketSchema ou ticketListSchema | Cria DRAFT/lista; title/objective/acceptanceCriteria com limites |
| POST /api/tickets/:id/ready | readyTicketSchema → ticketSchema | Ticket+outbox atômicos, snapshot ExecutionSpecification, dedupe ticket:{id}:ready |
| GET /api/runs?projectId=UUID e /api/runs/:id | runSummarySchema / runDetailSchema | Até 50 runs/tentativas recentes; não cria Run |
| POST /api/runs/:id/control | requestRunControlSchema → runControlReceiptSchema | expectedVersion/attemptId/action PAUSE ou CANCEL; pending=true é intenção, não stop |
| POST /api/runs/:id/resume | requestRunResumeSchema | expectedVersion/attemptId/artifactDigest; valida checkpoint/bundle/stop e publica outbox, nova tentativa/fence |
| POST /api/runs/:id/recover-finalization | requestRunRecoverySchema → runRecoveryReceiptSchema | FINALIZATION_ONLY; REQUESTED não significa concluído; sem novo writer/IA |
| GET /api/runs/:id/delivery | runDeliveryStateSchema | delivery nullable e reason normalizado; Markdown/digests exatos |
| POST /api/runs/:id/approve-delivery | approveRunDeliverySchema → runSummarySchema | version/attempt/deliveryDigest, gate válido em VALIDATING; grava approval e DONE |
| GET /api/projects/:id/events e events/stream | projectEventCursorSchema → páginas/SSE | Cursor decimal string persistido; Last-Event-ID, Bearer header, polling fallback |
| GET /api/operation; PUT /api/operation/scheduling | operation DTO; updateFactorySchedulingSchema | Observação read-only; pause com expectedVersion, default true no DB |
| GET/PUT /api/settings e subrotas de integrações | schemas factory/settings/onboarding/verification/PR | Config singleton versionada; states só por evidência worker; PR preparar/aprovar separado |

[Catálogo completo de controllers](catalogo-rotas.md) inclui health, integrações, login/challenge e protocolo interno. Os schemas linkados são fonte única dos campos: não copiar todos os DTOs para este capítulo.

## Divergências resolvidas

Não existe POST /runs nem POST /tickets/:id/runs no código. READY e claim implementam o fluxo; não há header Idempotency-Key genérico. POST /tickets da ESPEC histórica corresponde fisicamente à rota aninhada por projeto. Pause/cancel são action no endpoint control; aprovação é approve-delivery. Eventos são por projeto, não GET /runs/:id/events. Nenhum alias foi implementado por esta migração.

## Erros e versionamento

400 em payload/UUID inválido; 401 em auth ausente/incorreta; 404 quando objeto não é encontrado; 409 em conflito de estado/versão/revisão/evidência. Respostas Nest padrão não são envelope de erro versionado compartilhado; OpenAPI completo é pendência. POST usa status padrão Nest quando não há override, mas esta migração não testou HTTP real. Tenancy e convenção 403/404 são alvo posterior.

Schemas de execução usam schemaVersion=1; configuração/entidade têm version otimista distinta. Alterar código/schema exige revisar produtores/consumidores e compatibilidade legada; não aceitar documentação como migration. Efeitos externos nunca são inferidos do exit code.

## Exemplo sintético, sem chamada HTTP

```json
{"title":"Validar campo","objective":"Recusar campo vazio","acceptanceCriteria":["Campo vazio é recusado"]}
```

Body válido de criação de ticket sob projeto cadastrado; UUID e Bearer só vêm do ambiente autorizado. READY envia `{"expectedVersion":1}`; repetir quando ainda READY e outbox existe devolve ticket sem outro evento. Quando já avançou, comportamento depende do estado e pode retornar conflito.

## Testes e limites

Testes versionados: control.service.spec.ts, run-control/resume/recovery/delivery e execution-results/artifacts specs em apps/api/src; contratos em packages/contracts/src. Não executados nesta migração. Rotas e schemas foram conferidos por leitura local. Revisão semântica independente/aceite da revisão documental permanece pendente.
