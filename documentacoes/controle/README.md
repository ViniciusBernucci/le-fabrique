# Controle administrativo

Status: controle base ACEITO no FAC-003; Centro de Configuracoes ACEITO no FAC-011.

A API NestJS expõe health sem autenticação e protege as rotas administrativas com um Bearer token vindo de `ADMIN_API_TOKEN`. O painel solicita esse token ao operador, mantém o valor somente durante a sessão do navegador e chama contratos validados por Zod.

Projetos registram nome, URL do repositório e referência base. Tickets registram objetivo, critérios, estado e versão otimista. A transição `DRAFT -> READY` grava o ticket e `ticket.ready.v1` na outbox em uma única transação. Quando a referência base já é um SHA Git de 40 caracteres, ela segue no evento como `baseRevision`; referências ainda não resolvidas seguem como `null` e o worker não inicia claim. A chave `ticket:{id}:ready` impede evento duplicado em retry.

Rotas atuais:

- `GET /api/auth/session`
- `POST|GET /api/projects`
- `POST|GET /api/projects/{projectId}/tickets`
- `POST /api/tickets/{ticketId}/ready`
- `GET|PUT /api/settings`
- `POST|GET /api/settings/github/verifications`
- `POST|GET /api/settings/github/onboarding`
- `GET /api/settings/github/onboarding/{sessionId}/challenge`

FAC-011 adiciona uma configuracao administrativa singleton no PostgreSQL. O update exige `expectedVersion` e valida de forma atomica instalacoes de clientes oficiais, catalogos de modelos, atribuicoes por funcao, metadados GitHub e protecoes financeiras. Objetos sao estritos: credenciais, tokens e campos desconhecidos sao rejeitados. Os defaults nao afirmam elegibilidade — contas ficam desabilitadas, `AUTH_REQUIRED` e sem modelos ate preflight do worker. O update administrativo tambem nao pode promover estado de provider ou GitHub; essas observacoes ficam reservadas a evidencia do worker.

FAC-011A permite pedir/listar verificacoes GitHub. A criacao grava `GithubVerification` e outbox na mesma transacao; start/complete ficam em rotas `/api/internal/github-verifications/{id}/...` protegidas por `WORKER_API_TOKEN`. Somente a conclusao valida do worker altera o estado observado e incrementa a versao da configuracao. Credenciais e output bruto nao pertencem a esses contratos.

FAC-011B adiciona sessoes GitHub e `github.onboarding.requested.v1`. Rotas internas `/api/internal/github-onboarding/{id}/...` iniciam, publicam desafio e concluem sob `WORKER_API_TOKEN`. PostgreSQL nunca recebe o desafio; a rota administrativa le o valor efemero do Redis. Conclusao `CONNECTED` exige `SECURE_STORE`; login/verificacao ativos se excluem e host alterado invalida a sessao antiga.

FAC-008 conecta o evento `READY` ao BullMQ por dispatcher idempotente, oferece o protocolo interno de runs/attempts, leases, fencing e checkpoints e liga ao worker um consumidor restrito ao probe sintetico. O consumidor do runtime real ainda nao esta ligado ao loop principal. SSE, usuarios multiplos, login gerenciado e conexao GitHub pertencem aos proximos tickets.
