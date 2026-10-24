# Perfil das skills — La fabrique

Leia integralmente as [políticas de IA](../docs/00-governanca/01-POLITICA-IA.md) e [documentação](../docs/00-governanca/02-POLITICA-DOCUMENTACAO.md), além de [AGENTS](../AGENTS.md), [Manual Vivo](../docs/01-README.md), ticket e capítulos afetados. Skill não substitui autorização do usuário, política nem restrições do ambiente.

## Contexto confirmado

Fábrica com React/TypeScript/Vite em apps/web, NestJS/TypeScript em apps/api, worker Node/TypeScript separado em apps/worker, packages/contracts e packages/runtime, PostgreSQL e Redis/BullMQ na mesma VPS Linux/Compose. Stack aceita em ADR-003; preservar stack distinta somente em projeto externo. API não executa clientes/builds/testes. Outbox fica no banco; lock da fila não substitui lease/fencing nem prova término do writer.

O projeto não usa ClickUp ou ORCA. Não exigir IDs/URLs dessas ferramentas, publicador externo, diretórios Windows, SQL Server ou passos manuais herdados. O fluxo local usa [backlog](../docs/08-desenvolvimento/09-backlog.md), tickets em docs/08-desenvolvimento/tickets e Git. Preserve IDs FAC/OPS/LF-MT/DOC existentes. Tenancy/broker/RLS permanecem direção proposta, não implementação aceita por esta adaptação.

## Autoridade e evidência

Trabalhe no escopo autorizado, confirme branch/SHA/status e preserve trabalho prévio. Um writer por workspace e um executor inicial; ausência de prova de parada bloqueia recovery concorrente. Handoff contém revisão, patch/untracked sanitizados, hashes, limites e confirmação externa de término. Não usar sessão privada como estado portátil.

Não iniciar subagentes automaticamente: precisam de pedido explícito ou instrução aplicável de delegação. Quem implementa não aprova independentemente o próprio código/QA. Se não houver sessão independente, registrar autorrevisão e gate pendente, sem simular aprovação. Até duas rodadas de correção; persistindo falha, checkpoint e diagnóstico.

Autorização existente vale durante a tarefa. Não acrescentar confirmações por rotina, por nome de ferramenta ou por convenção importada. Merge/push/PR/deploy/produção/gastos seguem autorização pertinente, sem serem concedidos pela skill. Preparar artefatos revisáveis antes de eventual aprovação obrigatória. Read-only ou acesso negado é limite concreto; não contornar permissões.

Clientes oficiais com assinaturas; API/extras/créditos/autorecharge/fallback pago desligados. Não ler/exportar auth, tokens ou credenciais, nem montar auth na sandbox/controle. CLI sem ponte suportada continua incompatível; não converter OAuth em API. Sources sincronizado é read-only.

## Registro e checks locais

Capítulos atuais usam NN-titulo.md em ordem didática, introdução/navegação e ORDEM-LEITURA.json. Tickets mantêm IDs, entregas mantêm datas; não numerar snapshots históricos. Atualizar módulos/features/contratos/ADRs/runbooks apenas quando afetados. Registro completo em docs/09-entregas/AAAA/AAAA-MM-DD-ID-assunto.md; evidências/reviews/fila/estado operativo do ticket em docs/09-entregas/AAAA/evidencias/ID/. Usar o [template de entrega](../docs/00-governanca/templates/08-ENTREGA.md), sem duplicar conteúdo normativo. Históricos são append-only; erratas identificadas. Changelog/backlog/índice atualizados quando afetados. Lessons somente efetivamente aplicadas.

Comandos existentes, confirmar scripts/manifests antes de rodar: npm run lint, npm run typecheck, npm test, npm run build; checks por workspace quando suficientes. Testes PostgreSQL/Redis requerem ambiente de teste apropriado e não ativam produção. npm run db:deploy/db:migrate, providers:setup/login, preflights reais e backup operativo não são checks documentais automáticos. Edição de skills sem mudança funcional não exige repetir suíte inteira de software.

Rodar python3 scripts/validar-documentacao.py e validador de skills disponível; scripts modificados exigem checks pertinentes. Registrar comando/revisão/resultado/evidência e NOT_RUN quando ausente. Exit code ou relato não provam critérios de aceite. Implementado, verificado e aceito são dimensões separadas. DONE exige aceite humano da revisão exata, sem promover backlog de software por concluir documentação.

## Localização e descoberta

skills/ contém as versões adaptadas deste projeto; .agents/skills permanece importado e somente leitura no ambiente desta entrega. Se a sessão oferecer nome/descrição da cópia importada, abrir skills/<nome>/SKILL.md e este perfil antes de aplicar o fluxo. Guias de raiz apontam a fonte corrente. Descoberta automática de skills/ NÃO VERIFICADA: usar leitura explícita; não instalar links ou alterar configuração global para presumir autoload.
