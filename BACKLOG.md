# Backlog v2

- FAC-012Z: AWAITING_HUMAN — gate documental técnico implementado em `9c48dd9`, configuração UI/READY/compilador, revisão semântica e hashes exatos; 422 testes/checks. Sem provider/piloto/deploy. [Evidências](documentacoes/controle/2026-10-03-FAC-012Z-gate-documentacao-tecnica.md).

- FAC-012Y: AWAITING_HUMAN — alternativas UI/handoff no workflow real, código `f66a923`, 411 testes/checks; limites/stop/snapshot/restore/lease preservados, sem operação real. [Relatório](documentacoes/handoff/2026-10-03-FAC-012Y-handoff-configurado.md).

- FAC-012X: AWAITING_HUMAN — espera provider com stop/snapshot e retomada explícita, código `345e8ef`, 399 testes/checks; migration não aplicada. [Relatório](documentacoes/operacao/2026-10-03-FAC-012X-espera-provider.md).

- FAC-012W: AWAITING_HUMAN — entrega íntegra ampliada 8 MiB JSON/6 MiB raw, código `2a1ae96`, 387 testes/checks. [Relatório](documentacoes/controle/2026-10-03-FAC-012W-artefatos-ampliados.md).

- FAC-012V: AWAITING_HUMAN — identidade privada por instalação UI no login/status/runtime, código `22f6375`, 380 testes/checks. Claude escrita bloqueada; [relatório](documentacoes/runtime/2026-10-03-FAC-012V-identidades-instalacoes.md).

- FAC-012U: AWAITING_HUMAN — recuperação de journal/checkpoint sem IA/novo writer, código `9d4a4f1`, 370 testes/checks. [Relatório](documentacoes/controle/2026-10-03-FAC-012U-recuperacao-finalizacao.md).

- FAC-012T: AWAITING_HUMAN — retomada explícita parada/íntegra, objetivo congelado, novo fence e baseline pré-restore; código `42e7037`, 355 testes/checks. [Relatório](documentacoes/controle/2026-10-03-FAC-012T-retomada-snapshot.md).

- FAC-012S: AWAITING_HUMAN — pausa/cancelamento no painel com stop/snapshot/journal, código `be4e2ff`, 336 testes/checks. Migration não aplicada; [relatório](documentacoes/controle/2026-10-03-FAC-012S-comandos-run.md).

- FAC-012R: AWAITING_HUMAN — snapshot/observações de interrupção conhecida e término unknown sticky, código `abfb033`, 315 testes/checks; [relatório](documentacoes/operacao/2026-10-03-FAC-012R-snapshot-interrupcao.md).

- FAC-012Q: AWAITING_HUMAN — relatório determinístico de entrega/aceite exato no painel, código `bfd8532`, 306 testes/checks. Migration não aplicada; [relatório](documentacoes/controle/2026-10-03-FAC-012Q-documentacao-aceite-entrega.md).

- FAC-012P: AWAITING_HUMAN — diff e bundle do último snapshot no painel, até 64 KiB, código `739cff0`, 289 testes/checks. Migration não aplicada; [relatório](documentacoes/controle/2026-10-03-FAC-012P-artefatos-painel.md).

- FAC-012O: AWAITING_HUMAN — journal privado de resultado normal antes da API, replay sem IA; código `016a5ef`, 266 testes/checks. [Relatório](documentacoes/operacao/2026-10-03-FAC-012O-journal-resultados.md).

- FAC-012N: AWAITING_HUMAN — reconciliação de checkpoint parado no replay sem checkout/IA; código `94b5d64`, 257 testes/checks locais. [Relatório](documentacoes/operacao/2026-10-03-FAC-012N-reconciliacao-checkpoint.md).

- FAC-012M: AWAITING_HUMAN — resultados persistidos/fenced e histórico no painel, código `14ae5ba`, 240 testes/checks locais. Migration não aplicada; diff completo/recuperação pendentes. [Relatório](documentacoes/controle/2026-10-03-FAC-012M-resultados-execucao-painel.md).

Estado atual consolidado em [CONTROLE-MVP.md](CONTROLE-MVP.md). OPS-006 integrou OPS-005/FAC-012K/L localmente e retirou worktrees comprovadamente integrados; pendências de software permanecem explícitas.

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.


FAC-000, FAC-001A e FAC-002 a FAC-009 estão DONE. FAC-011A/B/C/D foram aceitos. FAC-012A/B foram aceitos em 2026-10-02; OPS-003 registra os aceites e consolida deltas autorizados. FAC-012C/D/E/F/G/H/I/J estão implementados e aguardam aceite humano. OPS-005 removeu o consumidor fixture do código e preparou um unit host, ainda não instalado; a execução real continua desligada. FAC-012D restringe o Codex, mas não cobre Claude nem comprova isolamento sob identidade real. FAC-010 está WAITING_PROVIDER. O projeto externo permanece indefinido.

- FAC-000: DONE — Bootstrap TypeScript e Docker aceito no SHA `15c2198076a6a6afcbf2f15212ae1eaf53822b9f`; dependências: ADR-002 e ADR-003.
- FAC-001: DEFERRED — Definir contrato do piloto externo após o núcleo da plataforma; dependências: FAC-011.
- FAC-001A: DONE — Definicao generica e versionada de projeto no painel e gate de READY aceitos na revisao `094190af26c1175bad08eb46293230b2938843d4`; sem hardcode do piloto ou de contas de IA; dependências: FAC-003, FAC-003A e FAC-011.
- FAC-002: DONE — Codex validado e aceito na revisão `1666ee108343563e35edb6971bea11234a62d47e`; dependências: FAC-004.
- FAC-003: DONE — Controle web e persistência aceitos no SHA `1807330bcf7b1374fa626d9fcbfc47dd8002f433`; dependências: FAC-000.
- FAC-003A: DONE — Gate de revisao-base exata antes de READY, barreira no dispatcher e atualizacao configuravel no painel aceitos na revisao `4630ce0b9a613b937d40d550e4551fa1402d6c6a`; dependências: FAC-003 e FAC-008.
- FAC-004: DONE — Worker interno e identidade de serviço aceitos no SHA `6d73041bdcbd50215b6a018c9937475c29f542b1`; dependências: FAC-003.
- FAC-005: DONE — Runtime Gateway e adapter Codex aceitos na revisão `9102fcc614739fd7bd7ca4992b16617db92ca66f`; dependências: FAC-002, FAC-004.
- FAC-006: DONE — Context Builder e RuntimeGuard aceitos na revisão `ea8cf7afb0e55840722f306262b5334bb408b51a`; dependências: FAC-003.
- FAC-007: DONE — Sandbox e snapshots aceitos na revisão `2bf14f35de64f118ec8224fee6151e60027dedb0`; dependências: FAC-004, FAC-005.
- FAC-008: DONE — Orquestrador e checkpoints aceitos na revisao `29061a911e0f6bc5122e9e53511f2f475caf8dce`; dependências: FAC-006, FAC-007.
- FAC-009: DONE — Coordenador de Developer, checks e Reviewer aceito na revisao `02819fb847e303f1a823cc2784a7326ec5e696f9`; dependências: FAC-008.
- FAC-010: WAITING_PROVIDER — FAC-010A DONE na revisao `7c8d95eecc33488c43d7bf6d6166bedd6c143341`, FAC-010B DONE na revisao `d39412282d9401b2a22c70eb4b353883e559be4c` e FAC-010C DONE na revisao `0748f029a8a62ce891486dc5751c207bdd6e56db`; codigo do segundo adapter/handoff aceito, validacao operacional aguarda login/preflight Claude posterior.
- FAC-011: DONE — Centro de Configuracoes aceito na revisao `e41ec1e45273aba3205f266e8753dfca305c5952`; dependências: FAC-003 e FAC-009.
- FAC-011A: DONE — Verificacao GitHub CLI aceita na revisao `dce2e676a91b5ffaeb246afeea2cc699e60aff9d`; dependência: FAC-011.
- FAC-011B: DONE — Login GitHub web/device aceito na revisao `3ac8b39de9024576df5c5709022bb4a01e5ea6a5`; dependência: FAC-011A.
- FAC-011C: DONE — Verificacao somente-leitura de repositorio/branch aceita na revisao `8fd38781652fac187d0f5a419eb336c15e94b816`; dependência: FAC-011B. `gh` e integracao real permanecem nao verificados.
- FAC-011D: DONE — Gate em duas etapas, prova de push, reconciliacao e criacao de PR aceitos na revisao `76df60bbad4eac78b5d87fad8c2e79282355bf8c`; dependência: FAC-011C. Prova real e merge permanecem pendentes.
- FAC-012: PLANEJADO — Piloto, dez tickets e operação; dependências: FAC-001, FAC-011.
- FAC-012K: AWAITING_HUMAN — `LeaseGuard` no worker renova com o fencing token, aborta na perda/expiração da lease e só relata quiescência quando o callback confirma. Implementação `8f254e8`; não integrado ao consumer.
- FAC-012L: AWAITING_HUMAN — consumer real implementado em `54bf483`, com checkout/workflow configurado, lease/fencing, cancelamento e checkpoint; default desabilitado. Recuperação, artefatos no painel e handoff pendentes. Relatório `documentacoes/operacao/2026-10-03-FAC-012L-consumer-execucao-real.md`.
- FAC-012A: DONE — Snapshot imutavel de projeto/definicao/ticket no evento READY; codigo `3b6f3e4624b5935e4fe6ea067406c631a6b0ec32`, revisao documental aceita `3ef3d543b98fb48226714787315f4de947fa6dd9`; sem piloto.
- FAC-012B: DONE — Compilador de snapshot para DeveloperWorkflowRequest com perfil confiável injetado; código `e7b9bf60e03089c502255d19edbb5d1e31725d2c`, revisao documental aceita `3e28363b0642f8e05840bb649b681e3837e1e015`; consumer permanece desligado.
- FAC-012C: AWAITING_HUMAN — SandboxRunner read-only por padrão, caminhos de escrita explícitos e prova de isolamento; código `a8f7a66dfc1b5c58a0596611dc300559504709ce`, relatório `documentacoes/operacao/2026-10-02-FAC-012C-politica-escrita-sandbox.md`; sem ligar o consumer ou iniciar provider. CodexAdapter já aplica sandbox nativo; o escopo de escrita do CLI ainda é amplo e está em FAC-012D.
- FAC-012D: AWAITING_HUMAN — `allowedPaths` validado em runtime e encaminhado ao perfil Codex; leitura geral, escrita apenas nos caminhos existentes autorizados e `.git`/`.codex` negados. Código `04e5f30`; relatório `documentacoes/operacao/2026-10-02-FAC-012D-caminhos-escrita-cli.md`. Testes sintéticos, sem consumer/provider; Claude e identidade real do worker não verificados.
- FAC-012E: AWAITING_HUMAN — endpoint `GET /api/internal/worker-settings` fornece ao worker snapshot de configuração versionado/validado sem credenciais; defaults não persistidos têm versão 0. Código `4aca1e10085f047712766f51ca7e4e749508a7a9`, relatório `documentacoes/operacao/2026-10-02-FAC-012E-configuracao-runtime-worker.md`. Não altera consumer, DB ou autenticação.
- FAC-012F: AWAITING_HUMAN — router sem cache usa cada snapshot da interface para selecionar papel, instalação/modelo e adapter; sem fallback e Reviewer obrigatoriamente `READ_ONLY`. Código `950f3b62651b1e918bae09d89996af0d95e9fbee`, relatório `documentacoes/operacao/2026-10-02-FAC-012F-rota-agente-configurada.md`. Biblioteca não conectada ao consumer nem executada.
- FAC-012G: AWAITING_HUMAN — `DeveloperWorkflow` resolve adapter/modelo e permissão por função em cada chamada, inclusive correções; rota ausente e Reviewer com escrita falham sem executar cliente. Implementado em `e1e9828` e `4bed978`; relatório `documentacoes/operacao/2026-10-02-FAC-012G-workflow-rotas-por-funcao.md`. Consumer segue no probe.
- FAC-012H: AWAITING_HUMAN — `SandboxRunner` agora pivota para rootfs mínimo e remove capabilities antes de checks; teste antes/depois prova que host `/etc`, home, `/var`, cgroup e mount escape não ficam acessíveis, sem perder workspace escopado, temporários, runtime `/usr`, rede bloqueada e quiescência. Nenhum provider ou consumer foi usado; relatório operacional FAC-012H.
- FAC-012I: AWAITING_HUMAN — perfil versionado por projeto configura fontes de contexto e checks aprovados; READY exige ambos e o compilador cruza o snapshot com perfil confiável. Evidências e limites em `documentacoes/operacao/2026-10-02-FAC-012I-perfil-execucao-projeto.md`.
- FAC-012J: AWAITING_HUMAN — preparador de checkout isolado usa root/hosts locais, credencial oficial efêmera com origem `keyring` e SHA detached verificado; não está conectado ao consumer. Relatório: `documentacoes/infraestrutura/2026-10-02-FAC-012J-checkout-confiavel-worker.md`.
- FAC-013: PLANEJADO — Terceiro adapter e QA UI; dependências: FAC-012.
- OPS-001: DONE — `.env` carregado no comando raiz, registro inicial com retry transitorio limitado e bootstrap usando migrations versionadas; aceito na revisao `7c1d1dcb44ab3464085aad729ae2b5dbdc473057`, dependências: FAC-000 e FAC-004.
- OPS-003: AWAITING_HUMAN — Aceites FAC-012A/B registrados; bind loopback e migration corretiva integrados em `e09204c5205af047d79bcd7d530a1acd1db563ca`, migration não aplicada.
- OPS-004: AWAITING_HUMAN — merges locais D e E–J e limpeza pós-merge documentados em `documentacoes/operacao/2026-10-03-OPS-004-consolidacao-worktrees.md`; sem push/deploy.
- OPS-005: AWAITING_HUMAN — worker host systemd preparado, APIs/Redis somente em loopback e consumidor fixture retirado do `main.ts`. Implementação `8f3dbda`; relatório `documentacoes/infraestrutura/2026-10-03-OPS-005-worker-host-sandbox.md`. Não instalado; worker container antigo continua ativo até janela manual.

Infraestrutura VPS única incluída em FAC-002/003/004/007/012; perfil Bom recomendado.

- OPS-006: AWAITING_HUMAN — integração local OPS-005/K/L, correção do env/user manager e controle atual do MVP; 227 testes/checks combinados passaram. Código `26e412d`; sem push/deploy. Relatório `documentacoes/operacao/2026-10-03-OPS-006-integracao-local-controle-mvp.md`.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
