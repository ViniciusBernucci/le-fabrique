# Changelog

## 2.55 - 2026-10-02
FAC-012D implementa passagem runtime de `allowedPaths` do snapshot para o perfil do Codex, mantém Reviewer/read-only sem escrita e nega `.git`/`.codex`; 175 testes, lint, typecheck e build passaram. Aguarda aceite; sem provider/consumer real.

## 2.54 - 2026-10-02
FAC-012D fica READY para restringir a escrita do CodexAdapter aos caminhos `allowedPaths` congelados no projeto, sem ativar consumer ou chamar provider.

## 2.53 - 2026-10-02
FAC-012C implementa política read-only por padrão e caminhos explícitos para o SandboxRunner. Lint, typecheck, 172 testes e build passaram; consumer permanece desligado porque o CLI Developer ainda não está confinado.

## 2.52 - 2026-10-02
FAC-012C fica READY para tornar o SandboxRunner read-only por padrão e permitir somente caminhos graváveis explícitos, com prova via teste Linux de integração; consumer e provider continuam desligados.

## 2.51 - 2026-10-02
Responsável aceita FAC-012A/B nas revisões documentais exatas. OPS-003 registra os aceites e integra bind loopback no proxy e migration corretiva para alinhar defaults UUID/índice do Prisma; lint, typecheck, 169 testes, build, Prisma validate e Compose config passaram. Migration não aplicada; aguarda revisão humana OPS-003.

## 2.50 - 2026-10-02
OPS-003 fica READY para registrar os aceites explícitos FAC-012A/B e reconciliar bind local da porta de origem e migration Prisma corretiva, sem aplicar migration ou fazer deploy.

## 2.49 - 2026-10-02
FAC-012B implementa compilador puro de snapshot para DeveloperWorkflowRequest, com vínculo exato de checkout, allowlist argv, fontes dentro dos caminhos permitidos e limites confiáveis injetados. Lint, typecheck, 169 testes e build passaram; consumer real permanece desligado e escrita por caminho ainda requer enforcement no sandbox.

## 2.48 - 2026-10-02
FAC-012B fica READY para compilar snapshot READY em pedido de workflow validado, exigindo perfil de checkout/allowlist confiável injetado; consumer, provider, piloto e execução permanecem desligados.

## 2.47 - 2026-10-02
FAC-012A implementa snapshot imutavel de projeto, definicao e ticket no evento READY, com invariantes cruzadas e bloqueio de eventos legados incompletos. Passaram 163 testes, lint, typecheck, build e Prisma validate; nenhum piloto/provider foi executado e a revisao aguarda aceite.

## 2.46 - 2026-10-02
FAC-012A fica READY para transformar a configuracao generica de projeto e o ticket em especificacao imutavel no evento READY, sem cadastrar piloto, executar worker real ou escolher provider.

## 2.45 - 2026-10-02
O responsavel aceitou FAC-003A na revisao `4630ce0b9a613b937d40d550e4551fa1402d6c6a` e FAC-001A na revisao `094190af26c1175bad08eb46293230b2938843d4`. O proximo incremento interno pode preparar FAC-012 sem cadastrar o projeto externo.

## 2.44 - 2026-10-02
FAC-001A implementa definicao generica, persistida e versionada de projetos no painel. READY agora exige SHA e definicao; 160 testes, lint, typecheck, build e Prisma validate passaram. O piloto e as contas de IA nao foram embutidos no codigo.

## 2.43 - 2026-10-02
FAC-001A fica READY para implementar a definicao versionada de projetos pelo painel. O incremento nao embute piloto, repositorio, comandos nem contas de IA no codigo e nao altera o Provider Manager existente.

## 2.42 - 2026-10-02
FAC-003A exige SHA-base exato antes de READY, oferece update otimista no painel e impede evento legado nulo de chegar ao worker. Passaram 155 testes, lint, typecheck, build e schema Prisma; nenhum banco/fila foi alterado e a revisao aguarda aceite.

## 2.41 - 2026-10-02
FAC-003A passa a READY apos diagnostico dos logs: os UUIDs eram jobs distintos publicados com `baseRevision: null`, nao retry infinito. O incremento bloqueia novos eventos invalidos e torna o SHA exato configuravel, sem limpar a fila.

## 2.40 - 2026-10-02
OPS-001 aceito explicitamente pelo responsavel na revisao `7c1d1dcb44ab3464085aad729ae2b5dbdc473057`. O proximo incremento investiga de forma nao destrutiva os jobs sinteticos invalidos observados no ensaio.

## 2.39 - 2026-10-02
OPS-001 implementa launcher raiz com `.env`, URL same-origin no Vite, retry transitorio limitado do registro do worker e procedimento `db:deploy`. Passaram 148 testes, lint, typecheck, build e schema Prisma; nenhum banco/fila foi alterado e a revisao aguarda aceite.

## 2.38 - 2026-10-02
OPS-001 passa a READY para corrigir o bootstrap reproduzido pelo responsavel: carregamento do `.env` raiz, tolerancia limitada a corrida de inicializacao da API e uso de migrations versionadas, sem limpar filas ou aplicar mudancas no banco.

## 2.37 - 2026-10-02
FAC-011D aceito pelo responsavel na revisao `76df60bbad4eac78b5d87fad8c2e79282355bf8c`. PR sob gate humano esta concluido em codigo; prova real permanece futura e o proximo incremento trata falhas observadas no bootstrap local.

## 2.36 - 2026-10-02
FAC-011D implementa preparacao e aprovacao exata de PR, outbox somente no gate, prova `permissions.push`, reconciliacao e `gh pr create` limitado, sem merge/push. Passaram 143 testes, lint, typecheck, build e Prisma; `gh` segue ausente, nenhuma escrita real ocorreu e aguarda aceite.

## 2.35 - 2026-10-02
FAC-011C aceito pelo responsavel na revisao `8fd38781652fac187d0f5a419eb336c15e94b816`. Verificacao somente-leitura de repositorio/branch esta concluida em codigo; prova real permanece futura e FAC-011D passa a ser o proximo incremento.

## 2.34 - 2026-10-02
FAC-011C implementa verificacao autenticada e somente-leitura do repositorio/branch GitHub salvo: snapshot/outbox, fila dedicada, duas chamadas `GET` fixas pelo worker, evidencia integral ou falha sem metadado parcial e painel sanitizado. Passaram 134 testes, lint, typecheck, build e schema Prisma; `gh` segue ausente, nenhuma chamada remota ocorreu e a revisao aguarda aceite.

## 2.33 - 2026-10-02
FAC-011B aceito pelo responsavel na revisao `3ac8b39de9024576df5c5709022bb4a01e5ea6a5`. Login GitHub gerenciado esta concluido em codigo; instalacao/keyring/login reais permanecem futuros e FAC-011C passa a ser o proximo incremento.

## 2.32 - 2026-10-01
FAC-011B implementa login GitHub web/device iniciado no painel: sessao/outbox sem segredo, desafio efemero no Redis, worker com argv fixo e cancelamento, ambiente sem tokens e confirmacao obrigatoria de `tokenSource=keyring`. Fallback `hosts.yml` falha fechado. Passaram 123 testes, lint, typecheck, build e schema Prisma; `gh` segue ausente e a revisao aguarda aceite.

## 2.31 - 2026-10-01
FAC-011B passa a READY para login web/device oficial do GitHub CLI: desafio efemero no Redis, nenhum PAT no controle, argv fixo e conexao somente quando o cliente confirmar credential store seguro. `gh` continua ausente e nenhuma autenticacao sera executada na implementacao com fixtures.

## 2.30 - 2026-10-01
FAC-011A aceito pelo responsavel na revisao `dce2e676a91b5ffaeb246afeea2cc699e60aff9d`. A verificacao somente-leitura esta concluida; instalacao e login real permanecem futuros e FAC-011B passa a ser o proximo incremento.

## 2.29 - 2026-10-01
FAC-011A implementa verificacao GitHub CLI somente-leitura: contratos estritos, outbox/fila dedicada, worker com argv fixo, ambiente sem variaveis de token, timeout/limite de output, estado atomico e painel com historico. Passaram 109 testes, lint, typecheck, build e schema Prisma; `gh` esta ausente, nenhuma integracao real foi executada e a revisao aguarda aceite.

## 2.28 - 2026-10-01
FAC-011A passa a READY para verificar instalacao e autenticacao do GitHub CLI pelo worker. O escopo e somente leitura, remove variaveis de token e proibe importar/exibir credenciais; login, PR, merge, deploy e instalacao do `gh` ficam fora deste incremento.

## 2.27 - 2026-10-01
FAC-010C aceito pelo responsavel na revisao `0748f029a8a62ce891486dc5751c207bdd6e56db`. O codigo de adapter/handoff esta concluido; FAC-010 permanece `WAITING_PROVIDER` somente para validacao operacional futura da conta Claude.

## 2.26 - 2026-10-01
FAC-010C implementa contratos multi-provider, adapter Claude subscription-only fail-closed, selecao de conta/modelo por funcionario e handoff por nova worktree/snapshot verificado sem transferir sessao privada. O verificador Claude tambem passa a rejeitar login Console/API. Foram usados apenas fixtures; aguarda aceite e a conta real continua deslogada.

## 2.25 - 2026-10-01
FAC-010B aceito pelo responsavel na revisao `d39412282d9401b2a22c70eb4b353883e559be4c`. FAC-010C passa a ser o proximo incremento para segundo adapter e handoff seguro.

## 2.24 - 2026-10-01
FAC-010B implementa login Codex por device code iniciado no painel: sessao/outbox persistem somente metadados, desafio fica no Redis privado com TTL, worker usa comando fixo e confirma autenticacao por status antes de marcar `AVAILABLE`. Fixtures passaram sem login real; aguarda aceite.

## 2.23 - 2026-10-01
FAC-010A aceito pelo responsavel na revisao `7c8d95eecc33488c43d7bf6d6166bedd6c143341`. FAC-010B passa a ser o proximo incremento para login efemero iniciado no painel.

## 2.22 - 2026-10-01
FAC-010A implementa verificacao gerenciada de Codex, Claude Code e Antigravity pelo worker, com pedido/outbox atomicos, fila separada, comandos fixos, timeout/log limit, resultado sanitizado e atualizacao de estado reservada ao worker. Painel solicita e acompanha sem iniciar login ou prompt; aguarda aceite.

## 2.21 - 2026-10-01
FAC-011 aceito pelo responsavel na revisao `e41ec1e45273aba3205f266e8753dfca305c5952`. FAC-010 passa a READY para implementar onboarding oficial iniciado pelo painel e executado pelo worker antes do preflight/handoff.

## 2.20 - 2026-10-01
FAC-011 foi antecipado e implementa o Centro de Configuracoes: multiplas contas Codex/Claude/Antigravity, catalogos e modelos padrao, provider/modelo/permissoes/limites por funcionario e metadados GitHub. Persistencia PostgreSQL usa versao otimista; contratos rejeitam segredos, estados comprovados ficam reservados ao worker e API, extras, creditos, autorecharge, fallback pago e merge permanecem desligados. Login, discovery, conexao GitHub, migration real e deploy nao foram executados; a revisao aguarda aceite humano.

## 2.19 - 2026-10-01
FAC-010 inicia preflight do segundo provider e entra em WAITING_PROVIDER: Claude Code 2.1.285 e Antigravity CLI 1.2.14 estao instalados, mas ambos exigem login. Nenhum prompt, API, credito, extra ou mudanca de autenticacao foi executado.

## 2.18 - 2026-10-01
FAC-009 aceito pelo responsavel na revisao `02819fb847e303f1a823cc2784a7326ec5e696f9`; FAC-010 passa a ser o proximo ticket READY.

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
