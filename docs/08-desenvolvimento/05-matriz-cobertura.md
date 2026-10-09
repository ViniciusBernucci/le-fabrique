> Leitura: [← Anterior](04-testes.md) · [Índice didático](../02-INDEX.md) · [Próximo →](06-controle-mvp.md)

> Nota DOC-MV-001: tabela original local preservada como evolução v1→v2, não evidência de kit v1 localizado ou testes revalidados nesta sessão. Fonte única da migração real é governança/MAPA-SECOES-REPO.json.

# Cobertura e migração v1 -> v2
Fonte: kit v1 e PDF original recuperados nesta tarefa, mais nova direção fornecida pelo usuário. Estrutura e requisitos anteriores preservados/adaptados; alterações incompatíveis substituídas.
| Tema anterior | Tratamento v2 | Documento |
|---|---|---|
| VPS única para tudo | VPS única para controle e execução | Arquitetura 1-3 |
| IA por API | Clientes oficiais/assinatura; API futura desligada | Runtime; Fontes |
| AI Gateway | Agent Runtime Gateway, lifecycle real dos CLIs | ESPEC-MVP; Runtime |
| ModelRouter | Elegibilidade/capacidade/cota e desempenho medido | Arquitetura 7 |
| TokenMeter/CostLedger/BudgetGuard | UsageMeter + custos fixos/extras + RuntimeGuard; API budget futuro | Economia; Especificação |
| Simulação API por tokens | Substituída por TCO/atribuição; sem promessa de tickets | Arquitetura 8 |
| Context Builder/cache/Batch | Contexto enxuto; cache condicionado; Batch só futuro API | Arquitetura 6; Economia |
| MacBook fora V1 | Sem dependência no MVP; execução na VPS | Operação |
| Docker/worktrees/testes | Mantidos no worker, isolamento do cliente e código | Arquitetura 9; Operação |
| Tickets/estados/recuperação | Acrescenta espera, leases, cancel e checkpoint | Especificação; Handoff |
| Arquiteto/Tech Lead/Developer/Review/QA/docs | Papéis mantidos; mínimo Developer/Reviewer | Arquitetura 5 |
| R0-R4 e escopo pequeno | Mantidos; piloto R0/R1 | Arquitetura 5; PILOTO |
| APIs internas/entidades | Atualizadas com workers/installations/checkpoints | ESPEC-MVP |
| Documentação por domínio/diffs | Mantida obrigatória em toda entrega | Política; templates |
| Lessons com exemplos | Mantidas, reais e sem duplicação | Política; template |
| Guias Claude/Codex/Antigravity | Atualizados para clientes/assinaturas | Três MDs |
| Sprints/épicos/subtarefas | Replanejados, 12 tickets MVP + 1 evolução | PLANO-MVP; BACKLOG |
| Backups/disco/retention | VPS única com recuperação a ensaiar | Operação; Arquitetura 3 |
| Dashboard/custos/aceite | Uso observado/unknown, mobile, revisão exata | Arquitetura 12 |
| Temporal/autoscaling/GPU | Evoluções condicionais | Arquitetura 10 |
| Handoff entre providers | Novo contrato seguro incluindo untracked | Handoff; template |
| Fontes/pendências | Revalidadas; não inventar capacidades | FONTES; PILOTO |

Revisão 2.3: VPS única aceita; perfis mínimo/bom/ideal incorporados ao MVP, ADR-002 e dimensionamento. Evidências de implantação seguem pendentes.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.

## Cobertura DOC-MV-001

[Mapa de migração](../00-governanca/10-MAPA-MIGRACAO.md), [seções e hashes](../00-governanca/MAPA-SECOES-REPO.json), [AS-IS](../02-arquitetura/01-as-is.md). Políticas correntes em docs/00-governanca; relatórios/lessons realocados com bridges. Sem novo DONE de software.

## Cobertura FAC-032

Menu principal reduzido: seis rótulos na ordem solicitada, destinos existentes e acessibilidade preservados. Testes web existentes (46), typecheck, build e lint PASS. Conferência do diff da lista realizada; browser e revisão independente NOT_RUN. [Entrega](../09-entregas/2026/2026-10-07-FAC-032-menu-inicial-reduzido.md).

## Cobertura FAC-033

Quadro/lista de tarefas demonstrativas, filtros, edição e vínculo com agentes por projeto. Sete novos testes cobrem limites de atribuição, critérios, dependências, preservação de tarefas manuais e navegação acessível. Integração com PostgreSQL/onboarding/worker permanece PLANEJADA; sem alteração de enums/contratos de execução. [Entrega](../09-entregas/2026/2026-10-07-FAC-033-painel-tarefas.md).

## Cobertura FAC-034

Tokens HUD globais, frame/home e todas as áreas do painel; estados reais de execução separados das nove etapas de demonstração. Specs preservam limites mock, contratos/aria e cobrem tom de mensagens, mapeamento de estados e redução de movimento. [Entrega](../09-entregas/2026/2026-10-07-FAC-034-centro-comando.md). Browser/revisão independente NÃO VERIFICADOS por limites do ambiente; sem mudanças em backend, providers, schemas ou C4.

## Cobertura FAC-035

Nome próprio opcional separado do cargo para agentes pré-configurados e personalizados. Contratos cobrem leitura legada, trim, remoção e limite; testes web cobrem resumo e rótulos acessíveis; serviço cobre gravação versionada do nome. Browser, revisão independente, integração e aceite pendentes. [Entrega](../09-entregas/2026/2026-10-08-FAC-035-nomes-agentes.md).

Adendo FAC-035 (2026-10-09): contrato CommonJS antigo reproduzido e preparação predev validada; 53 testes de contratos, 8 SettingsService e 2 launcher PASS. Browser e banco real NÃO VALIDADOS. [Correção](../09-entregas/2026/2026-10-09-FAC-035-correcao-salvamento-nomes.md).

## FAC-037 — Cadastro de integração e seleção de IA/modelo

| Critério | Código/check | Limite |
|---|---|---|
| API/CLI em cadastro; chave separada | contracts/api-registration.spec.ts; api/settings/api-registration.spec.ts | Sem chamada externa |
| Criptografia autenticada vinculada à conta | api/settings/api-key-encryption.spec.ts | Fixtures sintéticas |
| Somente IAs habilitadas e modelos da IA | web/AgentModelSelector.spec.tsx | Browser pendente |
| Conta API não executa CLI | worker/configured-agent-router.spec.ts | Sem adapter API |

[Evidências e resultados](../09-entregas/2026/2026-10-09-FAC-037-api-cli-agentes.md#testes-e-evidências).
