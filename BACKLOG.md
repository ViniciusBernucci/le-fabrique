# Backlog v2

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.


Nenhum ticket DONE; FAC-001 aguarda definição do repo/piloto. Não preencher prazo contratual sem capacidade definida.

- FAC-000: PRONTO PARA REVISÃO — Bootstrap TypeScript e Docker; dependências: ADR-002 e ADR-003.
- FAC-001: PLANEJADO — Contratar piloto; dependências: nenhuma.
- FAC-002: PLANEJADO — Validar clientes e baseline assistido; dependências: FAC-001.
- FAC-003: PLANEJADO — Controle web e persistência; dependências: FAC-002.
- FAC-004: PLANEJADO — Worker interno e identidade de serviço; dependências: FAC-003.
- FAC-005: PLANEJADO — Runtime Gateway e primeiro adapter; dependências: FAC-002, FAC-004.
- FAC-006: PLANEJADO — Context Builder e RuntimeGuard; dependências: FAC-001, FAC-003.
- FAC-007: PLANEJADO — Sandbox e snapshots recuperáveis; dependências: FAC-004, FAC-005.
- FAC-008: PLANEJADO — Orquestrador e checkpoints; dependências: FAC-006, FAC-007.
- FAC-009: PLANEJADO — Developer, checks e revisão; dependências: FAC-008.
- FAC-010: PLANEJADO — Segundo provider e handoff automático; dependências: FAC-005, FAC-008, FAC-009.
- FAC-011: PLANEJADO — Gate documental e Provider Manager; dependências: FAC-009, FAC-010.
- FAC-012: PLANEJADO — Dez tickets e operação; dependências: FAC-011.
- FAC-013: PLANEJADO — Terceiro adapter e QA UI; dependências: FAC-012.

Infraestrutura VPS única incluída em FAC-002/003/004/007/012; perfil Bom recomendado.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
