# Controle administrativo

FAC-012Q: GET `/api/runs/:id/delivery` gera Markdown/gate a partir de READY congelado/evidências; POST `/api/runs/:id/approve-delivery` AdminAuthGuard/expectedVersion/attempt/deliveryDigest registra aceite exato e só então DONE em run/ticket. Checks/review/bundle/stop precisam coincidir, replay igual não duplica; stale falha. Painel exige confirmar critérios/diff/docs e loadedVersion atual. Relatório não substitui documentação técnica no projeto. [Evidências](2026-10-03-FAC-012Q-documentacao-aceite-entrega.md).

FAC-012P: POST interno `/api/internal/orchestration/attempts/:id/artifact` (WorkerAuthGuard) persiste bundle estrito/imutável/fenced após relatório correspondente. GET `/api/runs/:runId/attempts/:attemptId/artifact` (AdminAuthGuard) confere vínculo e retorna artifact nullable. Painel carrega sob demanda com abort, diff escapado/download JSON; não executa patch. Migration não aplicada, teto 64 KiB. [Relatório](2026-10-03-FAC-012P-artefatos-painel.md).

FAC-012N adiciona POST interno de reconciliação por tentativa, WorkerAuthGuard e payload estrito workerId/fence, response state nullable. Não é comando administrativo de retry nem prova de parada fornecida pelo painel. Completar não pode reescrever terminal/outcome divergente ou estado humano. [Evidências](../operacao/2026-10-03-FAC-012N-reconciliacao-checkpoint.md).

## Atualização FAC-012M

GET `/api/runs?projectId=UUID` e `/api/runs/:runId` usam AdminAuthGuard e limitam consultas a 50 registros/tentativas recentes. POST `/api/internal/orchestration/attempts/:attemptId/result` exige WorkerAuthGuard, worker/fence atuais e relatório estrito até 64 KiB. Resultado imutável não libera writer. Painel exibe histórico/checks/revisão/metadados/chamadas, polling sequencial/cancelável; desconhecidos não são estimados. Migration versionada, não aplicada; sem aprovação/retomada automática. [Relatório](2026-10-03-FAC-012M-resultados-execucao-painel.md). Passagens abaixo sobre probe/bibliotecas descrevem seus incrementos históricos; estado integrado atual é FAC-012L/M, gate desligado.

Status: controle base ACEITO no FAC-003; Centro de Configuracoes ACEITO no FAC-011.

A API NestJS expõe health sem autenticação e protege as rotas administrativas com um Bearer token vindo de `ADMIN_API_TOKEN`. O painel solicita esse token ao operador, mantém o valor somente durante a sessão do navegador e chama contratos validados por Zod.

Projetos registram nome, URL do repositório e referência base. Tickets registram objetivo, critérios, estado e versão otimista. FAC-003A permite trocar a referencia por um SHA Git minusculo de 40 caracteres com comparacao otimista. A transição `DRAFT -> READY` so grava ticket e `ticket.ready.v1` quando esse SHA ja esta resolvido; falha de elegibilidade ocorre antes de qualquer mutacao. A chave `ticket:{id}:ready` impede evento duplicado em retry.

FAC-001A adiciona `ProjectDefinition`, configurada pelo painel sem hardcode de projeto ou piloto. Ela persiste descricao, stack externa, instrucoes, caminhos permitidos/proibidos e checks em `argv`, com contrato Zod e versao otimista. Definicao ausente e retornada como `null`; nenhum default sintetico finge inspecao. Novos READY exigem definicao e registram `projectDefinitionVersion`. Contas, providers, modelos e papeis continuam separados em `FactorySettings`.

FAC-012I adiciona `executionProfile` opcional à definição: o operador lista fontes de contexto individuais dentro de caminhos permitidos e marca checks configurados para execução autônoma. A API exige perfil não vazio antes de promover ticket a READY e congela o perfil no snapshot. O worker compara fontes e checks resolvidos localmente com o snapshot e compila somente checks aprovados. Editar comando/argumentos revoga a aprovação no painel. Perfil vazio continua válido para rascunho, nunca para READY.

Rotas atuais:

- `GET /api/auth/session`
- `POST|GET /api/projects`
- `PATCH /api/projects/{projectId}/base-revision`
- `GET|PUT /api/projects/{projectId}/definition`
- `POST|GET /api/projects/{projectId}/tickets`
- `POST /api/tickets/{ticketId}/ready`
- `GET|PUT /api/settings`
- `GET /api/internal/worker-settings` (somente `WORKER_API_TOKEN`)
- `POST|GET /api/settings/github/verifications`
- `POST|GET /api/settings/github/onboarding`
- `GET /api/settings/github/onboarding/{sessionId}/challenge`

FAC-011 adiciona uma configuracao administrativa singleton no PostgreSQL. O update exige `expectedVersion` e valida de forma atomica instalacoes de clientes oficiais, catalogos de modelos, atribuicoes por funcao, metadados GitHub e protecoes financeiras. Objetos sao estritos: credenciais, tokens e campos desconhecidos sao rejeitados. Os defaults nao afirmam elegibilidade — contas ficam desabilitadas, `AUTH_REQUIRED` e sem modelos ate preflight do worker. O update administrativo tambem nao pode promover estado de provider ou GitHub; essas observacoes ficam reservadas a evidencia do worker.

FAC-012E expõe snapshot da configuração somente ao worker autenticado. A resposta usa contrato Zod estrito, inclui versão e instante de observação, lê sem escrita e cai em defaults inativos/version 0 se a linha ainda não existir. O endpoint não expõe o registro Prisma nem inclui campos de credencial.

FAC-011A permite pedir/listar verificacoes GitHub. A criacao grava `GithubVerification` e outbox na mesma transacao; start/complete ficam em rotas `/api/internal/github-verifications/{id}/...` protegidas por `WORKER_API_TOKEN`. Somente a conclusao valida do worker altera o estado observado e incrementa a versao da configuracao. Credenciais e output bruto nao pertencem a esses contratos.

FAC-011B adiciona sessoes GitHub e `github.onboarding.requested.v1`. Rotas internas `/api/internal/github-onboarding/{id}/...` iniciam, publicam desafio e concluem sob `WORKER_API_TOKEN`. PostgreSQL nunca recebe o desafio; a rota administrativa le o valor efemero do Redis. Conclusao `CONNECTED` exige `SECURE_STORE`; login/verificacao ativos se excluem e host alterado invalida a sessao antiga.

FAC-011C adiciona `GET/POST /api/settings/github/repository-verifications` e as rotas internas `/api/internal/github-repository-verifications/{id}/start|complete`. Pedido e `github.repository-verification.requested.v1` sao atomicos e guardam snapshot do alvo, nunca credencial. O complete so aceita o worker autenticado, reconfere configuracao `CONNECTED` e alvo atual e persiste evidencia integral ou falha sem observacao parcial; a API nao executa `gh`.

FAC-011D adiciona `GET/POST /api/settings/github/pull-requests`, `approve` e `cancel`, alem das rotas internas `start|complete`. Somente `approve` cria outbox; `expectedVersion` e digest vinculam o gate ao payload exato. Complete reconfere alvo/opt-in e URL. API nao executa escrita GitHub.

FAC-008 conecta o evento `READY` ao BullMQ por dispatcher idempotente, oferece o protocolo interno de runs/attempts, leases, fencing e checkpoints e liga ao worker um consumidor restrito ao probe sintetico. O consumidor do runtime real ainda nao esta ligado ao loop principal. SSE, usuarios multiplos, login gerenciado e conexao GitHub pertencem aos proximos tickets.

FAC-003A tambem protege a fronteira do dispatcher: evento legado PENDING com `baseRevision: null` nunca chega a `queue.add` e converge para `FAILED` pelo limite da outbox. Eventos e jobs historicos permanecem preservados; nao existe limpeza automatica neste fluxo.

FAC-012A torna o evento READY autocontido: `executionSpecification` copia projeto, SHA, definicao completa e ticket dentro da mesma transacao. O contrato cruza IDs e versoes do snapshot com o envelope. Atualizar a definicao depois nao altera eventos anteriores, e evento legado sem snapshot nao e publicado. O responsavel aceitou FAC-012A na revisao documental `3ef3d543b98fb48226714787315f4de947fa6dd9`.

FAC-012B consome esse snapshot apenas como dado de entrada de um compilador puro no worker. Perfil local confiável e allowlists não são aceitos do job; nenhum campo administrativo inicia comando por si só. O responsável aceitou FAC-012B na revisão documental `3e28363b0642f8e05840bb649b681e3837e1e015`. O consumer continua em probe até enforcement de caminhos de escrita, binding/checkout confiável, provider elegível e integração de lease/fencing serem demonstrados.
