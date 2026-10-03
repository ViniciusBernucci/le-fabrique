# Changelog

## 2026-10-03 — FAC-012AC

Claim consulta writer global; índice parcial garante exclusão concorrente entre runs, sem liberar por lease/status. 448 verificações passaram; piloto removido dos requisitos de conclusão do software nos documentos atuais. [Evidências](documentacoes/controle/2026-10-03-FAC-012AC-writer-global.md).

## 2026-10-03 — FAC-012AB

Cinco testes de composição real do worker verificam bytes/bundle/documentação, restore/handoff e replay conservador; typecheck da integração incluído no comando raiz. 438 testes passaram, runtime inalterado. [Relatório](documentacoes/operacao/2026-10-03-FAC-012AB-ensaio-integrado-mvp.md).
## 2026-10-03 — FAC-012AA

Claude usa perfil granular e factory exige prova privada atual de permissão nativa; preflight oficial opt-in verifica traces/canários/binário e preserva evidências. 433 testes/checks, código `56f2e38`; nenhuma prova real/ativação/piloto/deploy. [Relatório](documentacoes/runtime/2026-10-03-FAC-012AA-confinamento-claude.md).

## 2026-10-03 — FAC-012Z

Política documental pela interface; READY/compilador exigem configuração; workflow valida alteração/estrutura/hashes, Reviewer confere semântica e mutação durante review invalida aprovação. Controle cruza conjunto/manifesto antes do aceite. Código `9c48dd9`, 422 testes/checks, sem operação/deploy. [Relatório](documentacoes/controle/2026-10-03-FAC-012Z-gate-documentacao-tecnica.md).

## 2.88 - 2026-10-03

FAC-012Y permite alternativas explícitas na UI e handoff sequencial seguro de Developer/Reviewer, sem sessão privada/fallback pago/reset de limites. 411 testes/checks; evidências em resultado/painel, Claude escrita/docs técnicas pendentes, aceite separado.

## 2.87 - 2026-10-03

FAC-012X conecta auth/cota/busy à espera persistida por provider, com stop/snapshot/journal antes de finalização fenced. Sem correções/retries de IA para provider indisponível; retomada explícita por evidência. 399 testes/checks, migration não aplicada, aceite pendente.

## 2.86 - 2026-10-03

FAC-012W amplia bundles worker/API/painel para 8 MiB JSON/6 MiB raw, sem truncamento, mantendo hashes/gates e leitura bounded. HTTP aceita envelope limitado e rejeita excessos com 413; 387 testes/checks, aceite pendente, sem operação real.

## 2.85 - 2026-10-03

FAC-012V liga clientes oficiais à identidade privada da instalação selecionada na UI, com ambiente allowlisted e Codex file/ChatGPT. Sem credencial global compartilhada no consumer; Claude escrita bloqueada até prova granular. 380 testes/checks; nenhum login/deploy, aceite pendente.

## 2.84 - 2026-10-03

FAC-012U adiciona recovery administrativo FINALIZATION_ONLY via outbox/consumer, journal/reconcile sem claim/IA. BLOCKED_RECOVERY só conclui com stop/evidência íntegra; unknown não libera writer. 370 testes/checks passaram; operação/manual/MVP restante explícitos.

## 2.83 - 2026-10-03

FAC-012T liga retomada humana de snapshot íntegro/parado à outbox/claim/fence novo, baseline limpo antes de restore/contexto reconstruído. Restauração recusa symlinks; Developer falho preserva progresso. 355 testes/checks; sem operação real/handoff automático, aceite pendente.

## 2.82 - 2026-10-03

FAC-012S conecta pausa/cancelamento autenticado/otimista no painel à renew do worker. Pedido não libera writer; stop/snapshot/journal antes de PAUSED/CANCELLED. 336 testes/checks passaram; migration versionada. Retomada/MVP completo pendentes; aceite humano separado.

## 2.81 - 2026-10-03

FAC-012R preserva observações/snapshot em AbortSignal após parada comprovada, journal CANCELLED e reconciliação coerente. Unknown fica sticky; ausência/falha de evidência mantém fence. 315 testes/checks verdes. Crash abrupto/retomada e providers/controles/docs técnicas pendentes; aguarda aceite humano.

## 2.80 - 2026-10-03

FAC-012Q gera relatório de entrega por READY imutável/evidências e vincula aceite humano explícito a resultado+bundle+documento exatos. Gate exige stop/review/checks; stale rejeitado, replay idempotente, DONE só após ação humana. 306 testes/checks passaram; migration approval/RunStatus.DONE não aplicada. Documentação técnica interna do projeto e controles de execução pendentes.

## 2.79 - 2026-10-03

FAC-012P entrega patch/untracked íntegros ao painel com download JSON sob demanda, DTO 64 KiB, hashes e bloqueio de padrões conhecidos de segredo. Artifact fenced/imutável antes de checkpoint/complete; falha preserva journal. 289 testes/checks passaram, migration não aplicada; aceite humano pendente.

## 2.78 - 2026-10-03

FAC-012O preserva resultado normal em journal privado/atômico/fsync antes da API; redelivery recupera same attempt/fence sem IA/claim/checkout. 266 testes/checks passaram. Sem limpeza automática; interrupção antes de retorno e agendamento de retry pendentes. Aguarda aceite humano.

## 2.77 - 2026-10-03

FAC-012N reconcilia replay após checkpoint parado sem novo writer/IA; deriva outcome da evidência, valida digest/snapshot e preserva estados terminais/humanos. 257 testes/checks locais passaram; nenhum serviço/banco alterado. Resultado não persistido e interrupção desconhecida seguem pendentes; AWAITING_HUMAN.

## 2.76 - 2026-10-03

FAC-012M persiste resultados imutáveis/fenced antes de concluir e expõe histórico/checks/revisão/metadados/chamadas no painel. DTO minimizado 64 KiB e polling cancelável. 240 testes, typecheck/build/lint/Prisma validate passaram. Migration não aplicada; diff completo/recuperação pendentes; aguarda aceite humano. Sem piloto/push/deploy.

## 2.75 - 2026-10-03
OPS-006 consolida OPS-005/FAC-012K/L localmente em developer, resolve conflitos preservando gate/host worker e corrige UID do user manager no env externo. 227 testes, lint, typecheck, build, Compose/systemd config e diff check passaram. Worktrees K/L/OPS-005 retirados após ancestry/limpeza; refs preservadas. CONTROLE-MVP.md lista funcionalidades/lacunas; aceites A/B reconciliados no plano. Sem push/deploy/piloto.

## 2.74 - 2026-10-03
FAC-012L implementa consumer real com gate desligado por padrão, checkout/SHA imutável, workflow com rotas configuradas, limites por função, lease/fencing, cancelamento e checkpoint antes de conclusão. Testes Linux comprovam cancelamento de descendente e ausência de confirmação quando systemd não pode ser consultado. Checks passaram; 227 testes finais distintos. Operação real, recuperação, artefatos no painel e handoff permanecem pendentes; aguarda aceite humano.

## 2.73 - 2026-10-03
FAC-012L fica READY para ligar com segurança o consumer real a checkout, workflow configurado, lease/fencing, quiescência e checkpoint; default desabilitado, sem provider ou piloto.

## 2.72 - 2026-10-03
FAC-012K implementa primitiva isolada para renovar lease com fencing token, abortar e aguardar confirmação de parada quando a autoridade é perdida; 211 testes, typecheck, lint e build passaram. Consumer, provider e checkout reais continuam desligados; aguarda revisão humana.

## 2.71 - 2026-10-03
OPS-005 prepara unit systemd para worker dedicado host na VPS, restringe API/Redis ao loopback e remove o consumidor de fixture da fila de execução. 206 testes, typecheck, lint, build, Compose config e systemd-analyze passaram; nenhum serviço ativo foi alterado, e OPS-005 aguarda aceite humano.

## 2.70 - 2026-10-03 — planejamento paralelo
FAC-012K fica READY para preparar renovação de lease e cancelamento conservador no worker, sem conectar o consumer ou executar trabalho real.

OPS-005 fica READY para preparar o worker host da VPS, desativar o consumidor fixture no Compose padrão e manter API/Redis privados em loopback. Sem alteração de serviço ativo, instalação, provider ou piloto. O número original de planejamento foi compartilhado pelas duas branches; ambos os registros foram preservados na integração.

## 2.69 - 2026-10-03
OPS-004 integra FAC-012D e FAC-012E–J localmente em `developer`; checks combinados passaram após regeneração local de artefatos derivados. Aceites FAC-012C–J seguem humanos; sem push, deploy, migration, consumer ou piloto.

## 2.68 - 2026-10-02
OPS-004 fica READY para consolidar localmente os branches de worktree autorizados FAC-012D e FAC-012E–J em developer, rodar checks combinados e retirar worktrees já integrados; sem push/deploy.

## 2.67 - 2026-10-02
FAC-012J implementa preparação isolada de checkout por execução no worker, com host HTTPS allowlisted, autenticação GitHub efêmera somente após confirmar keyring, Git sem shell/config/hooks e SHA detached verificado. 203 testes, typecheck, lint e build passaram; módulo não foi ligado ao consumer, e Git/GH/keyring reais não foram usados.

## 2.66 - 2026-10-02
FAC-012J fica READY para preparar checkouts efêmeros, com root/hosts do worker configuráveis, commit exato e sem executar conteúdo do repositório; consumer e rede real permanecem desligados.

## 2.65 - 2026-10-02
FAC-012I implementa perfil de execução versionado no projeto: contexto permitido e checks explicitamente aprovados no painel, bloqueio de READY sem perfil e compilação apenas dos checks aprovados. Testes, typecheck, lint e build passaram; worker continua sem checkout operacional e consumer segue desligado.

## 2.64 - 2026-10-02
FAC-012I fica READY para configurar perfil de execução por projeto e aprovar checks/contexto explicitamente antes do gate READY; sem checkout ou execução real.

## 2.63 - 2026-10-02
FAC-012H implementa raiz de sandbox com `pivot_root`, runtime read-only, workspace isolado e remoção de capabilities. A leitura sintética de `/etc/hostname` que antes funcionava agora é negada; a suíte confirma bloqueio de host paths e mount escape.

## 2.62 - 2026-10-02
FAC-012H fica READY após teste sintético mostrar que `SandboxRunner` ainda permite ler `/etc/hostname` do host; execução de checks permanece bloqueada até troca para uma raiz isolada.

## 2.61 - 2026-10-02
FAC-012G conecta DeveloperWorkflow às rotas atuais Developer/Reviewer, selecionando adapters/modelos por função em toda chamada e falhando antes do adapter quando a rota falta; consumer permanece no probe.

## 2.60 - 2026-10-02
FAC-012G fica READY para o workflow resolver adapters/modelos independentes por função em cada chamada, mantendo o consumer e clientes reais desligados.

## 2.59 - 2026-10-02
FAC-012F implementa router de runtime sem cache/fallback usando a configuração atual da interface, valida adapter e Reviewer READ_ONLY; 185 testes, lint, typecheck e build passaram. Nenhum adapter executado.

## 2.58 - 2026-10-02
FAC-012F fica READY para ligar, como biblioteca pura, configurações atuais de agentes aos adapters suportados sem fallback nem execução.

## 2.57 - 2026-10-02
FAC-012E implementa endpoint interno de leitura versionada da configuração validada para o worker, sem credenciais e sem persistir defaults; 178 testes, lint, typecheck e build passaram. Consumer/provider permanecem desligados.

## 2.56 - 2026-10-02
FAC-012E fica READY para disponibilizar ao worker leitura interna da configuração de providers/modelos da interface, sem segredos, mudança de DB ou execução.

## 2.55 - 2026-10-02
FAC-012D implementa passagem runtime de `allowedPaths` do snapshot para o perfil do Codex, mantém Reviewer/read-only sem escrita e nega `.git`/`.codex`; 175 testes, lint, typecheck e build passaram. Smoke test nativo no Codex CLI 0.159.2 confirmou as regras e rede local negada, sem inferência. Aguarda aceite; sem provider/consumer real.

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
