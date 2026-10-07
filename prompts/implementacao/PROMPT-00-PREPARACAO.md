# Prompt zero — preparar/refatorar sem habilitar a nova arquitetura

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.

Copie este documento integralmente para o agente no repositório real.

## Objetivo

Execute LF-MT-00: prepare a base React/NestJS/worker Node/TypeScript/PostgreSQL/Redis numa VPS única para as onze etapas de isolamento. Inspecione e refatore os pontos de acoplamento atuais sem ligar dispatch real de IA, migrar credenciais ou alegar que o isolamento já existe. Se a aplicação não existir, proponha e crie apenas o esqueleto mínimo autorizado do ticket, distinguindo claramente bootstrap de refatoração.

## Pré-condições e leitura

Ticket READY com escopo de preparação, acesso ao repositório real e baseline. Leia AGENTS/CLAUDE/ANTIGRAVITY locais, README, docs/00-governanca/POLITICA-IA.md, BACKLOG, PLANO-MVP, ESPEC-MVP, MATRIZ-COBERTURA, docs/INDEX.md, PILOTO, fontes e documentação runtime/arquitetura/infra/operação; leia todo este pacote relevante e auditoria de fontes. Não editar sources/. O espelho documental sozinho não autoriza afirmar que houve refatoração de software.

## Escopo e sequência

1. Inventarie entrypoints de React/NestJS/worker, auth/guards, controllers/repositories, DB migrations/roles/pool, Redis/cache/outbox, context builder, adapters, tool execution, Git/worktrees, artifact store, filesystem/segredos, containers/firewall/systemd, CI/tests e logs. Para cada item registre PRESENTE, AUSENTE ou NÃO VERIFICADO com caminho/revisão. Não ler nem imprimir o valor de credenciais.
2. Detecte autenticação global, HOME/env herdados, spawn shell/interpolação, mount amplo, Docker socket, rede compartilhada, API interna exposta a tools, sessões/caches globais, IDs sem tenant e comandos arbitrários. Mapeie caller e autoridade; prepare plano para removê-los, sem criar novo caminho inseguro.
3. Defina interfaces tipadas TenantContext/RunScope/ProviderInstallationRef, CredentialResolver (retorna handle interno, não string de segredo para o modelo), ProviderAdapter, SandboxDriver, PolicyEngine/ToolBroker, ContextBuilder e ArtifactStore. Separe módulos confiáveis de código/output hostil. Interfaces não devem esconder ferramenta genérica de host.
4. Desacople orchestration de provider concreto e configuração global. Adote config validada/schema_version e env allowlist por subprocesso, sem defaults permissivos. Novas funcionalidades ficam atrás de feature flags desabilitadas; ausente policy/preflight/tenant significa negar dispatch.
5. Preserve contratos atuais úteis com camada de compatibilidade que não resolve tenant/credencial por default global. Não atribuir registros órfãos a cliente arbitrário. Faça plano de migration/backfill/FK/RLS, rollout/rollback e restore de teste para etapa 02, sem migrar produção agora.
6. Prepare fixtures A/B e A1/A2, instalações fake por tenant, canários sintéticos, fake adapters e testes de contratos/baseline. Prepare harness Linux separado para testes futuros reais. Fake não habilita provider AVAILABLE.
7. Registre mapa de arquivos a alterar por etapa, dependências, riscos, gates e backlog. Remova referências contraditórias a Laravel/Angular apenas nos docs atuais aplicáveis, preservando histórico e stack do software piloto. Não instalar CLIs nem inventar suporte de ponte remota.

## Fora de escopo

Implementar todas as 11 etapas; provisionar/contratar VPS; configurar login real/armazenar tokens; alterar cobrança; migração irreversível de produção; API paga; segunda VPS; microserviços/Temporal; merge/deploy; liberar clientes hostis. Não alterar arquitetura somente para acomodar ferramenta incompatível.

## Critérios de aceite e testes negativos

Mapa de estado e paths reais completo; interfaces e boundaries revisáveis; build/typecheck/checks relevantes preservados; comportamento público existente continua verificável dentro do escopo. Nova feature flag off impede spawn de provider e criação de job; tenant/policy/installation ausentes não caem em conta global; API key herdada não é propagada para fixture de subprocesso; erro/config inválida falha fechado; input de modelo não escolhe paths/argv do host. Teste integração de seams com doubles sem alegar enforcement real. Falhas anteriores de baseline separadas das regressões. Entregar plano de rollback e inventário de testes Linux ainda não executados. Evidência de preparação não marca I-01–I-10 como implementados.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/piloto.md, docs/08-desenvolvimento/backlog.md, docs/08-desenvolvimento/plano-mvp.md, docs/05-contratos/README.md e docs/05-contratos/schemas/job-package.md, docs/08-desenvolvimento/matriz-cobertura.md, docs/INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/INDEX.md, docs/CHANGELOG.md, docs/08-desenvolvimento/backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


## Regra documental atualizada

[Política canônica](../../docs/00-governanca/POLITICA-IA.md) rege estado atual + registro de entrega + lessons pertinentes. Os caminhos antigos sobrevivem somente no histórico. O gate documental deve usar docs/09-entregas, não exigir documento novo em documentacoes/.


## Origem desta edição

[Versão original preservada](../../docs/99-historico/originais/output/le-fabrique-multitenant/prompts/PROMPT-00-PREPARACAO.md). Migração editorial de paths em 2026-10-06; conteúdo de engenharia continua proposto.
