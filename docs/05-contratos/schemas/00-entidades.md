> Leitura: [Índice didático](../../02-INDEX.md) · [Próximo →](01-workflow.md)

# Dados implementados e entidades propostas

[Schema Prisma canônico](../../../apps/api/prisma/schema.prisma) na revisão a2cc5e0. Modelos físicos: `Project`, `ProjectDefinition`, `Ticket`, `Run`, `Attempt`, `Checkpoint`, `OutboxEvent`, `WorkerIdentity`, `FactorySettings`, `ProviderVerification`, `ProviderOnboardingSession`, `GithubVerification`, `GithubOnboardingSession`, `GithubRepositoryVerification`, `GithubPullRequest`, `ProjectEventCursor`, `ProjectEvent`, `FactoryOperation`.

Project tem ProjectDefinition opcional e vários Tickets; Ticket tem Run opcional único; Run tem várias Attempts; Attempt tem Checkpoint opcional único. Result/artifact/approval/configuração são JSON/JSONB, não entidades físicas independentes de Ledger/Step/Usage. OutboxEvent é persistido no banco; ProjectEventCursor/ProjectEvent guardam cursor sequencial e invalidação; FactoryOperation é pausa global versionada/default true.

## Invariantes e limites

Chaves únicas ticketId/dispatchEventId, runId+sequence/fence, deduplicationKey; FKs Restrict. Índice parcial attempts_single_unconfirmed_writer e triggers/check constraints dependem das migrations SQL reais; schema Prisma sozinho não prova todos os controles. Snapshots/evidências ficam no filesystem privado e bundles validados no banco. Nenhum tenant_id, Membership, ProjectGrant, CredentialMetadata ou RLS versionados nesta base.

## Proposta posterior

[Tenancy/RLS](../../03-modulos/tenant-isolation/00-README.md) preserva cadeia/ownership/FKs compostas, pools LOCAL e testes SEC. JobPackage v3 é ilustrativo, sem schema implementado. Não atribuir dado órfão a tenant arbitrário. Dinheiro decimal/unknown são regras de direção; não há Ledger financeiro implementado a certificar.

## Compatibilidade e consumidores

API usa Prisma; painel/worker usam DTO Zod e nunca exportam credenciais/modelos de persistência ao bundle. Backup precisa preservar JSON, enums, índices, outbox, eventos/cursors e journal. Testes versionados e migrations são evidência de implementação; aplicação no DB ativo não foi inspecionada. [Enums atuais](01-workflow.md).

## Tarefas demonstrativas FAC-033

Fonte runtime: [taskSchema e workspaceSchema](../../../apps/web/src/tasks-model.ts). Namespace `le-fabrique.tasks.demo.v1` no localStorage; schemaVersion=1; catálogo demonstrativo de projetos/agentes e array de tarefas. Não é tabela PostgreSQL nem API de execução. Projetos/agentes reais são consultados na sessão autenticada, sem copiar contas/modelos/instruções para esse armazenamento.

Tarefa contém ID estável, código, projectId, assigneeId nullable, título, especificação, critérios, fase, etapa, prioridade, prazo ISO opcional, dependências por ID, origem example/manual e histórico com timestamp. Responsável precisa pertencer ao projeto e estar habilitado no momento do salvamento; referência removida é exibida como indisponível. Dependências devem existir no mesmo projeto, sem repetição, autorreferência ou ciclo. Troca de projeto limpa responsável/dependências e é recusada quando outra tarefa depende da tarefa editada.

Leitura inválida bloqueia gravação e mantém conteúdo original. Falha de gravação não aplica alteração na memória. Remoção de exemplos preserva tarefas manuais e remove vínculos com exemplos apagados. Não existe sincronização de escrita entre abas. Integração futura deve substituir essa fonte pela API e preservar controle de versão/snapshot/gates de execução; nenhum enum de Ticket/Run é modificado pelo quadro simulado.

## Nomes de agentes FAC-035

[agentAssignmentSchema e digitalAgentSchema](../../../packages/contracts/src/index.ts) admitem `nickname?: string`, com trim e até 100 caracteres, incluindo vazio. Em assignments, `role` mantém a identidade operacional e o cargo pré-configurado; em digitalAgents, `name` mantém a identificação anterior como cargo personalizado. O nome próprio não participa do roteamento, das permissões ou dos vínculos por ID.

Persistência: FactorySettings.configuration JSON pela rota versionada existente, sem nova coluna/migration/evento. Leitura de registros sem nickname continua válida; nome vazio/ausente exibe o cargo. Clientes antigos com schema strict anterior não aceitam nickname: publicar API/worker/painel compatíveis juntos; um cliente antigo que sobrescreve o JSON completo pode perder o nome. Rollback exige remover nickname de assignments/digitalAgents antes de ler a configuração com código anterior. Não houve alteração de dados ativos. [Entrega](../../09-entregas/2026/2026-10-08-FAC-035-nomes-agentes.md).

## Chaves de API FAC-037

`ProviderInstallation.authMode` passa a aceitar `SUBSCRIPTION_CLI` ou `API_KEY`; registros CLI existentes não precisam de conversão. API admite CODEX (OpenAI) e CLAUDE; ANTIGRAVITY API é rejeitado. Identidade do modo não muda no mesmo ID.

PUT `/api/settings` mantém `expectedVersion` e `configuration`, acrescentando `apiKeys` opcional: até 20 entradas de `installationId` e `key` (1–4096 caracteres, sem espaços). Duplicatas ou chave dirigida a conta CLI/inexistente são rejeitadas. Nova conta API e troca de fornecedor requerem chave. As respostas de configuração e snapshot do worker não possuem esse campo.

A tabela `provider_api_credentials` contém ID da instalação, fornecedor, ciphertext AES-GCM versionado e updated_at; não existe segredo no JSON FactorySettings. Nonce aleatório e AAD vinculam a cifra à instalação/fornecedor. Configuração, segredo e limpeza das contas removidas são escritos numa transação com concorrência otimista. A chave mestra hexadecimal de 32 bytes é configuração privada da implantação; ausência impede escrita do segredo. A tabela foi preparada por migration, aplicação operacional NÃO VERIFICADA.

Login/verificação CLI recusam contas API, inclusive resultados tardios; o roteador exige modo CLI além de estado AVAILABLE. API permanece apenas cadastrável/atribuível neste incremento. [Operação e rollback](../../09-entregas/2026/2026-10-09-FAC-037-api-cli-agentes.md#rollback).
