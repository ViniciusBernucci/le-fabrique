# Plano do MVP v2
Um módulo existente, um projeto, um worker, um writer. Sprints por objetivos de 1-2 semanas sugeridas, sem datas contratuais. Somatório estimado: 23-35 dias de engenharia para FAC-001 a FAC-012; calendário depende de disponibilidade e compatibilidade. FAC-013 é evolução opcional.
V0 assistida entrega aprendizado antes da plataforma; V1 valida runtime único; V2 testa handoff; Sprint 3 mede operação. Nenhum ticket está implementado.
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
Descrição: Selecionar e registrar perfil mínimo/bom/ideal, provisionar VPS única, redes/volumes/limites e backup externo; bootstrap proposto, auth administrativa, entidades/tickets/attempts e outbox; Redis/Postgres privados.
Subtarefas: registrar contrato e evidência de início; implementar menor incremento; verificar cenários de sucesso/falha descritos; revisar diff/limites; atualizar relatório por domínio, README atual, lessons pertinentes e backlog.
Aceite: Ticket autenticado persiste após reinício e dispatch idempotente; sem segredo em Git.
Entregáveis: código quando pertinente, checks reais, artefatos por revisão e documentação.

## FAC-004 — Worker interno e identidade de serviço
Sprint: Sprint 1. Dependências: FAC-003. Esforço estimado: 2-3 dias. Status: PLANEJADO.
Descrição: Registro restrito, claim, heartbeat, eventos, systemd, login oficial na identidade de serviço e limites globais; rede interna autenticada.
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
Descrição: Estados/outbox/leases, writer lock, pausa/cancel/resume e recovery conservador.
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
Descrição: Docs/lessons/índices, painel móvel, observações de cota com fonte e aceite por revisão.
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
