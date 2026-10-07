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
