# Controle administrativo

Status: IMPLEMENTADO no FAC-003; AGUARDANDO REVISÃO E ACEITE.

A API NestJS expõe health sem autenticação e protege as rotas administrativas com um Bearer token vindo de `ADMIN_API_TOKEN`. O painel solicita esse token ao operador, mantém o valor somente durante a sessão do navegador e chama contratos validados por Zod.

Projetos registram nome, URL do repositório e referência base. Tickets registram objetivo, critérios, estado e versão otimista. A transição `DRAFT -> READY` grava o ticket e `ticket.ready.v1` na outbox em uma única transação. A chave `ticket:{id}:ready` impede evento duplicado em retry.

Rotas atuais:

- `GET /api/auth/session`
- `POST|GET /api/projects`
- `POST|GET /api/projects/{projectId}/tickets`
- `POST /api/tickets/{ticketId}/ready`

O estado `READY` ainda não aciona o worker. Dispatcher, leases, fencing, SSE, usuários múltiplos e providers pertencem aos próximos tickets.
