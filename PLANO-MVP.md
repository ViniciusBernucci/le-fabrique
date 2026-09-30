# Plano do MVP v2

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

Um módulo existente, um projeto, um worker, um writer. Sprints por objetivos de 1-2 semanas sugeridas, sem datas contratuais. Somatório estimado: 23-35 dias de engenharia para FAC-001 a FAC-012; calendário depende de disponibilidade e compatibilidade. FAC-013 é evolução opcional.
V0 assistida entrega aprendizado antes da plataforma; V1 valida runtime único; V2 testa handoff; Sprint 3 mede operação. FAC-000 está implementado e aceito; FAC-001 a FAC-013 permanecem planejados.
## Épicos
Sprint 0: contrato e viabilidade. Sprint 1: controle, worker e runtime. Sprint 2: execução recuperável e providers. Sprint 3: documentação, painel e experimento. Evolução: terceiro adapter/capacidades novas.

## FAC-001 — Contratar piloto
Sprint: Sprint 0. Dependências: nenhuma. Esforço estimado: 1-2 dias. Status: PLANEJADO.
Descrição: Inspecionar repo, baseline, regras, caminhos e três tickets pequenos.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Contrato verificável e baseline reproduzido; não editar lógica fora do ticket.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-002 — Validar clientes e baseline assistido
Sprint: Sprint 0. Dependências: FAC-001. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Preflight de login/cobrança/isolamento na VPS selecionada; medir baseline de recursos, executar três tickets e handoff manual; confirmar providers um a um.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Um adapter elegível comprovado, três entregas e checkpoint recuperável; limites desconhecidos explícitos.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-003 — Controle web e persistência
Sprint: Sprint 1. Dependências: FAC-002. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Selecionar e registrar perfil mínimo/bom/ideal, provisionar VPS única, redes/volumes/limites e backup externo; bootstrap do monorepo React/NestJS/worker Node em TypeScript, contratos validados em runtime, auth administrativa, entidades/tickets/attempts e outbox; Redis/Postgres privados.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Ticket autenticado persiste após reinício e dispatch idempotente; sem segredo em Git.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-004 — Worker interno e identidade de serviço
Sprint: Sprint 1. Dependências: FAC-003. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Worker Node.js/TypeScript separado da API, consumo BullMQ idempotente, registro restrito, claim, heartbeat, eventos, systemd, login oficial na identidade de serviço e limites globais; rede interna autenticada.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Queda de rede interrompe writer antes do lease; job antigo não recebe conclusão válida; sem portas públicas de worker/banco/fila.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-005 — Runtime Gateway e primeiro adapter
Sprint: Sprint 1. Dependências: FAC-002, FAC-004. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Interface, execução segura por argv/stdin, fixtures/eventos e cliente oficial escolhido por preflight.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Execute/cancel/schema comprovados; auth/cota normalizados; modelo/uso desconhecido não inventados.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-006 — Context Builder e RuntimeGuard
Sprint: Sprint 1. Dependências: FAC-001, FAC-003. Esforço estimado: 1-2 dias. Status: PLANEJADO.
Descrição: Fontes determinísticas/hashes; limites de tentativas/tempo/troca; API/extra bloqueados.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Sem segredo/dependência no contexto; falha repetida pausa; keys herdadas não ativam API.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-007 — Sandbox e snapshots recuperáveis
Sprint: Sprint 2. Dependências: FAC-004, FAC-005. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Worktree isolado, recursos, serviços sintéticos, patches/untracked e revisão exata.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Sem host socket/home/segredos; timeout mata árvore; snapshot restaura arquivos rastreados e untracked.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-008 — Orquestrador e checkpoints
Sprint: Sprint 2. Dependências: FAC-006, FAC-007. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Orquestração NestJS, PostgreSQL/outbox, Redis/BullMQ e leases, writer lock, pausa/cancel/resume e recovery conservador.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Lease expirado sem quiescência bloqueia novo writer; eventos duplicados não repetem efeitos; retorno seguro após crash.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-009 — Developer, checks e revisão
Sprint: Sprint 2. Dependências: FAC-008. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Executar ticket, checks do repo, reviewer separado e correções limitadas.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Critérios comprovados na revisão exata; falhas anteriores separadas; até duas correções sem loop.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-010 — Segundo provider e handoff automático
Sprint: Sprint 2. Dependências: FAC-005, FAC-008, FAC-009. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Preflight segundo adapter, roteamento por capacidade e troca após término confirmado.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Simular cota, preservar patch/untracked, outro cliente continua sem writer concorrente; sem provider aguarda.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-011 — Gate documental e Provider Manager
Sprint: Sprint 3. Dependências: FAC-009, FAC-010. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Docs/lessons/índices, painel React responsivo com SSE autenticado e retomada, observações de cota com fonte e aceite por revisão.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Mudança sem docs falha; unknown visível; aprovação obsoleta rejeitada; docs atuais coerentes com código.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-012 — Dez tickets e operação
Sprint: Sprint 3. Dependências: FAC-011. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Ensaio incluindo falhas, backup/restauração, métricas de custo/espera/qualidade e retrospectiva.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Dez tickets contabilizados; restauração comprovada; metas avaliadas; zero cobrança extra/API não autorizada.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-013 — Terceiro adapter e QA UI
Sprint: Evolução. Dependências: FAC-012. Esforço estimado: 1-3 dias. Status: PLANEJADO.
Descrição: Validar provider restante e browser efêmero se piloto precisar.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Capacidades/termos/login/uso comprovados; critérios UI com evidências; sem sessão pessoal.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## Definition of Done
Aceite/critério com evidência, checks da revisão final, revisão resolvida, diff recuperável, estado de uso/custo honesto, docs atuais e relato datado, lessons pertinentes, índice/backlog atualizados e aceite humano. Sem merge/deploy automático.
## Experimento
Registrar todos os dez tickets, inclusive fracassos. Meta 8/10 em até duas correções; 100% documentados; zero extras/API não autorizados e zero writers concorrentes. Medir duração ativa/espera, retrabalho, handoffs, regressões, custos atribuídos e recursos. Decidir expandir/corrigir/pausar com dados; não adicionar segundo worker ou Temporal por antecipação.

## Infraestrutura obrigatória do MVP
Toda execução fica na mesma VPS; MacBook não é dependência. Assinaturas autenticadas nos clientes oficiais da VPS. Estimativas: Mínimo 4 vCPU/8 GB/120 GB; Bom recomendado 8 vCPU/16 GB/200 GB; Ideal 8 vCPU/32 GB/300 GB. Sem GPU. Um executor inicial em todos os perfis.
FAC-002 valida compatibilidade, login, extras desativados e baseline na VPS. FAC-003 registra plano contratado, limites e separação de redes/volumes. FAC-004 testa serviço/credenciais após reboot. FAC-007 prova que código não lê credenciais/controle. FAC-012 mede painel sob build, OOM/I/O/disco e restauração externa.
Aceite de infraestrutura: specs reais documentadas; checks do piloto cabem no envelope; sem OOM no ensaio; bancos privados; segredo inacessível ao código; nenhum efeito duplicado após reinício; backup externo restaurável. Na ocorrência de falha de capacidade, otimizar/subir perfil antes de ampliar concorrência.
Perfil Bom é recomendação de engenharia, não contratação autorizada. Preços, fornecedor e acesso ainda precisam ser informados para provisionar. Detalhamento em documentacoes/infraestrutura/DIMENSIONAMENTO-VPS.md.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
