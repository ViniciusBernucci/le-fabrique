# Backlog v2

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.


FAC-000 e FAC-002 a FAC-009 estão DONE. FAC-011A/B/C/D foram aceitos. FAC-010 esta WAITING_PROVIDER. O piloto externo permanece adiado; o ensaio manual revelou ajustes de bootstrap local a corrigir antes de novas features.

- FAC-000: DONE — Bootstrap TypeScript e Docker aceito no SHA `15c2198076a6a6afcbf2f15212ae1eaf53822b9f`; dependências: ADR-002 e ADR-003.
- FAC-001: DEFERRED — Definir contrato do piloto externo após o núcleo da plataforma; dependências: FAC-011.
- FAC-002: DONE — Codex validado e aceito na revisão `1666ee108343563e35edb6971bea11234a62d47e`; dependências: FAC-004.
- FAC-003: DONE — Controle web e persistência aceitos no SHA `1807330bcf7b1374fa626d9fcbfc47dd8002f433`; dependências: FAC-000.
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
- FAC-013: PLANEJADO — Terceiro adapter e QA UI; dependências: FAC-012.

Infraestrutura VPS única incluída em FAC-002/003/004/007/012; perfil Bom recomendado.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
