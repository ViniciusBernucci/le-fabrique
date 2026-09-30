# Backlog v2

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.


FAC-000 e FAC-002 a FAC-007 estão DONE. FAC-008 e o proximo ticket READY. O piloto externo permanece adiado até a validação operacional.

- FAC-000: DONE — Bootstrap TypeScript e Docker aceito no SHA `15c2198076a6a6afcbf2f15212ae1eaf53822b9f`; dependências: ADR-002 e ADR-003.
- FAC-001: DEFERRED — Definir contrato do piloto externo após o núcleo da plataforma; dependências: FAC-011.
- FAC-002: DONE — Codex validado e aceito na revisão `1666ee108343563e35edb6971bea11234a62d47e`; dependências: FAC-004.
- FAC-003: DONE — Controle web e persistência aceitos no SHA `1807330bcf7b1374fa626d9fcbfc47dd8002f433`; dependências: FAC-000.
- FAC-004: DONE — Worker interno e identidade de serviço aceitos no SHA `6d73041bdcbd50215b6a018c9937475c29f542b1`; dependências: FAC-003.
- FAC-005: DONE — Runtime Gateway e adapter Codex aceitos na revisão `9102fcc614739fd7bd7ca4992b16617db92ca66f`; dependências: FAC-002, FAC-004.
- FAC-006: DONE — Context Builder e RuntimeGuard aceitos na revisão `ea8cf7afb0e55840722f306262b5334bb408b51a`; dependências: FAC-003.
- FAC-007: DONE — Sandbox e snapshots aceitos na revisão `2bf14f35de64f118ec8224fee6151e60027dedb0`; dependências: FAC-004, FAC-005.
- FAC-008: READY — Orquestrador e checkpoints; dependências: FAC-006, FAC-007.
- FAC-009: PLANEJADO — Developer, checks e revisão; dependências: FAC-008.
- FAC-010: PLANEJADO — Segundo provider e handoff automático; dependências: FAC-005, FAC-008, FAC-009.
- FAC-011: PLANEJADO — Gate documental e Provider Manager; dependências: FAC-009, FAC-010.
- FAC-012: PLANEJADO — Piloto, dez tickets e operação; dependências: FAC-001, FAC-011.
- FAC-013: PLANEJADO — Terceiro adapter e QA UI; dependências: FAC-012.

Infraestrutura VPS única incluída em FAC-002/003/004/007/012; perfil Bom recomendado.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
