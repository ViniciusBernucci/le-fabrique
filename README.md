# Fábrica de Software — kit v2.3

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

29/09/2026. Planejamento completo: web na VPS, worker interno na VPS, clientes oficiais e assinaturas primeiro. APIs e créditos extras desligados no MVP. Não há implementação neste pacote.
## Começar
1. Ler documentacoes/arquitetura/ARQUITETURA.md, FONTES.md e PLANO-MVP.md.
2. Preencher PILOTO.md e executar FAC-001/FAC-002 antes de bootstrap completo.
3. Mesclar AGENTS.md e CLAUDE.md com regras existentes; preservar escopos locais.
4. Antigravity: ler ANTIGRAVITY.md e confirmar como a versão carrega regras; injetar explicitamente quando necessário.
5. Seguir documentacoes/POLITICA-IA.md em toda entrega; usar templates.
## Conteúdo
Arquitetura, contratos, backlog, políticas, guias dos três agentes, runtime, handoff, operação, economia, templates e matriz de migração. Configuração example é política da fábrica a implementar, não configuração nativa dos fornecedores.
O PDF reúne todos os Markdown deste kit, inclusive guias e templates. Markdown é fonte editável; ao atualizar, regenerar PDF a partir da mesma revisão. O pacote preserva a cobertura do kit anterior, substituindo decisões incompatíveis com a v2.

## Infraestrutura do MVP
Toda a fábrica executa na mesma VPS. Bom recomendado: 8 vCPU, 16 GB RAM, 200 GB SSD/NVMe, um executor inicial. Ler documentacoes/infraestrutura/DIMENSIONAMENTO-VPS.md e ADR-002; mínimo/ideal e condições de escala documentados. Revisão 2.3 mantém os nomes dos arquivos para continuidade.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
