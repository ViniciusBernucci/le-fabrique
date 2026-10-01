# Changelog

## 2.17 - 2026-10-01
FAC-009 implementa contratos e coordenador no worker para worktree, contexto, RuntimeGuard, baseline, Developer com escrita, checks isolados, snapshots e Reviewer separado somente leitura. Regressao nova, review invalido, processo sem parada confirmada e limites falham de forma conservadora. A integracao usa somente fixtures e aguarda aceite humano.

## 2.16 - 2026-10-01
FAC-008 aceito pelo responsavel na revisao corrigida `29061a911e0f6bc5122e9e53511f2f475caf8dce`; FAC-009 passa a ser o proximo ticket READY.

## 2.15 - 2026-10-01
FAC-008 corrige a reentrega entre checkpoint e conclusao para reutilizar o attempt parado, conecta o probe sintetico a fila `le-fabrique.execution` e propaga a revisao-base resolvida. Jobs sem SHA-base falham antes do claim; provider, API e cobranca extra continuam desligados. A revisao corrigida aguarda aceite humano.

## 2.14 - 2026-09-30
FAC-008 implementa dispatcher outbox/BullMQ idempotente, runs e attempts persistidos, leases, fencing monotono, checkpoint com parada confirmada e bloqueio conservador de recuperacao. Migration e fluxos reais PostgreSQL/Redis passaram; a revisao exata aguarda aceite humano e o consumidor completo fica no FAC-009.

## 2.13 - 2026-09-30
FAC-007 aceito pelo responsavel na revisao `2bf14f35de64f118ec8224fee6151e60027dedb0`; FAC-008 passa a ser o proximo ticket READY.

## 2.12 - 2026-09-30
FAC-007 implementa worktree detached, sandbox Linux sem root com namespaces e cgroup systemd, ambiente minimo, rede/home/socket ocultos, timeout confirmado e snapshots de patch binario/untracked com hashes e restauracao na revisao exata. A revisao funcional aguarda aceite; integracao ao worker e persistencia ficam no FAC-008.

## 2.11 - 2026-09-30
FAC-006 aceito pelo responsavel na revisao `ea8cf7afb0e55840722f306262b5334bb408b51a`; FAC-007 passa a ser o proximo ticket READY.

## 2.10 - 2026-09-30
FAC-006 implementa Context Builder deterministico com SHA-256, omissoes explicitas e bloqueio de segredo/dependencia, alem de RuntimeGuard subscription-only para tentativas, tempo, trocas de provider, falha repetida e remocao de chaves de API herdadas. A revisao funcional aguarda aceite humano; worker e orquestrador ainda nao usam os novos modulos.

## 2.9 - 2026-09-30
FAC-005 aceito pelo responsavel na revisao `9102fcc614739fd7bd7ca4992b16617db92ca66f`; FAC-006 passa a ser o proximo ticket READY.

## 2.8 - 2026-09-30
FAC-005 implementa contratos Zod do runtime e o primeiro adapter Codex com execucao sem shell, prompt por stdin, perfil restrito, JSONL sanitizado, uso/modelo nullable, status de auth, erros normalizados, limite de logs, timeout e cancelamento confirmado. A revisao funcional aguarda aceite humano; o worker ainda nao despacha jobs para o adapter.

## 2.7 - 2026-09-30
FAC-002 adiciona preflight reproduzivel do Codex CLI oficial com autenticacao ChatGPT, bloqueio de chaves de API herdadas, JSONL efemero, perfis de filesystem/rede restritos, canario de protecao do arquivo de autenticacao e fixtures sinteticas de leitura e escrita. A validacao tecnica passou.

FAC-002 aceita pelo responsavel na revisao `1666ee108343563e35edb6971bea11234a62d47e`; FAC-005 passa a ser o proximo ticket.

## 2.6 - 2026-09-30
FAC-004 implementa identidade persistida do worker, registro e heartbeat autenticados, listagem administrativa, bloqueio público das rotas internas e encerramento conservador após três falhas de heartbeat. Claim, leases, fencing e execução real permanecem planejados.

FAC-004 aceito pelo responsável nos commits apresentados; FAC-002 passa a ser o próximo ticket.

## 2.5 - 2026-09-30
FAC-003 implementa autenticação administrativa por token de ambiente, contratos Zod para projetos/tickets, endpoints NestJS, controle de versão otimista, outbox idempotente, migration aditiva e painel React para cadastro e promoção a `READY`. A composição completa e o fluxo HTTP foram validados localmente; dispatcher, worker real e deploy permanecem fora do escopo.

FAC-003 aceito pelo responsável nos SHAs apresentados; FAC-004 passa a ser o próximo ticket.

## 2.4 - 2026-09-30
Fundação executável criada em FAC-000: monorepo npm com React/Vite, NestJS, worker Node.js, contratos Zod, Prisma/PostgreSQL, Redis/BullMQ, migrations, health checks, testes e Docker Compose. Composição completa validada localmente; sem deploy ou integração com provedores.

FAC-000 revisado no SHA `15c2198076a6a6afcbf2f15212ae1eaf53822b9f` e aceito pelo responsável. Lint, typecheck, 7 testes, build, configurações Compose, saúde dos serviços de dados e migration inicial foram reconfirmados.

O responsável adiou a escolha do piloto externo até o núcleo da plataforma estar pronto. FAC-003 passa a ser o próximo ticket; FAC-002 usa cenário sintético para preflight, e FAC-001 volta antes do ensaio operacional FAC-012.

## 2.3 - 2026-09-30
Correção dos pontos de entrada dos agentes: stack aprovada em destaque, sem reconfirmação; distinção explícita entre fábrica e projetos externos; anexos atualizados e PDF/ZIP regenerados da mesma fonte. Esta entrega altera documentação; não implementa a plataforma.

# Changelog

## 2.2 - 2026-09-29
Stack aprovada React + NestJS + worker Node, todos em TypeScript. ADR-003, arquitetura, plano/backlog, especificação, guias, política e infraestrutura atualizados. Planejamento sem implementação.

## 2.1 - 2026-09-29
Decisão do usuário: toda a fábrica e autenticação na mesma VPS. Dimensionamento mínimo/bom/ideal, limites, ADR-002 e tarefas do MVP atualizados. Guias das três IAs alinhados. Nenhuma implantação realizada.


## 2.0 — 2026-09-29
Planejamento revisado para assinaturas e clientes oficiais; controle web + worker interno na VPS; gateway/runtime, router/cotas, handoff, isolamento, operação e custos adaptados. Guias das três IAs e templates atualizados. Cobertura v1 rastreada. Nenhum software implementado.
## 1.0 — 2026-09-29
Kit de planejamento anterior com execução por APIs na VPS, agora substituído nas decisões conflitantes.
