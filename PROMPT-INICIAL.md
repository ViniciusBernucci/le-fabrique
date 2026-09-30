# Prompt de início

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

Leia AGENTS.md (Codex), CLAUDE.md (Claude) ou ANTIGRAVITY.md (Antigravity), documentacoes/POLITICA-IA.md, README.md e PILOTO.md. Se o ambiente não carregar regras, considere-as explicitamente parte desta instrução.
Inspecione o estado real do repositório. Comece pelo menor ticket READY; se não houver, execute somente inspeção/planejamento de FAC-001. Não invente repo, modelo, cota ou teste. A arquitetura é assinatura/CLI oficial no worker interno na VPS, controle e execução na mesma VPS, APIs e créditos extras desligados.
Antes de executar, registre contrato, revisão e baseline. Preserve trabalho existente. Entregue código revisável, evidências, relato por domínio, documentação atual e lessons. Em interrupção, checkpoint com patch/untracked e próximos passos. Não implemente todo o backlog numa sessão sem validar incrementos.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
