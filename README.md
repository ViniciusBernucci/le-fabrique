# Fábrica de Software — kit v2.3

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

02/10/2026. FAC-000, FAC-001A, FAC-002 a FAC-009, FAC-010A/B/C, FAC-011A/B/C/D, FAC-012A/B e OPS-001 estão aceitos. O status por ticket está em [BACKLOG.md](BACKLOG.md); evidências e verificações estão nos relatórios indexados em [documentacoes/INDEX.md](documentacoes/INDEX.md). O consumer real ainda não está ligado; FAC-010 aguarda validação operacional Claude/GitHub. APIs de IA permanecem desligadas.

FAC-012L conecta perfil de projeto, checkout, workflow e lease/fencing/checkpoint ao consumer real, desabilitado por padrão por `WORKER_EXECUTION_ENABLED=false`. Aguarda aceite humano e preflight sob identidade de serviço. Recuperação, artefatos no painel e handoff automático continuam pendentes. Piloto externo segue manual e não está codificado. Veja [FAC-012L](documentacoes/operacao/2026-10-03-FAC-012L-consumer-execucao-real.md).
## Começar
1. Ler documentacoes/arquitetura/ARQUITETURA.md, FONTES.md e PLANO-MVP.md.
2. Cadastrar projetos e suas definicoes pelo painel; o projeto externo real continua indefinido ate o operador escolhe-lo. Revisar o Centro de Configuracoes FAC-011 e depois desbloquear o preflight do segundo provider conforme FAC-010; nao usar chave API como atalho.
3. Mesclar AGENTS.md e CLAUDE.md com regras existentes; preservar escopos locais.
4. Antigravity: ler ANTIGRAVITY.md e confirmar como a versão carrega regras; injetar explicitamente quando necessário.
5. Seguir documentacoes/POLITICA-IA.md em toda entrega; usar templates.
## Conteúdo
Arquitetura, contratos, backlog, políticas, guias dos três agentes, runtime, handoff, operação, economia, templates e matriz de migração. Configuração example é política da fábrica a implementar, não configuração nativa dos fornecedores.
O PDF reúne todos os Markdown deste kit, inclusive guias e templates. Markdown é fonte editável; ao atualizar, regenerar PDF a partir da mesma revisão. O pacote preserva a cobertura do kit anterior, substituindo decisões incompatíveis com a v2.

## Infraestrutura do MVP
Toda a fábrica executa na mesma VPS. Bom recomendado: 8 vCPU, 16 GB RAM, 200 GB SSD/NVMe, um executor inicial. Ler documentacoes/infraestrutura/DIMENSIONAMENTO-VPS.md e ADR-002; mínimo/ideal e condições de escala documentados. Revisão 2.3 mantém os nomes dos arquivos para continuidade.

## Desenvolvimento local

Requer Node.js 22.20.0, npm 10.9.3 e Docker com Compose. Para executar os serviços de dados e os processos em modo de desenvolvimento:

```bash
cp .env.example .env
docker compose -f compose.dev.yaml up -d
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

`npm run dev` carrega o `.env` raiz automaticamente; nao e necessario executar `source .env`. O painel fica em `http://localhost:5173` e encaminha `/api` para a API em `http://localhost:3000/api`, inclusive quando o painel e aberto pelo endereco de rede exibido pelo Vite. `db:deploy` aplica somente migrations versionadas; use `db:migrate` apenas ao criar conscientemente uma nova migration.

Para validar a composição completa, copie `.env.production.example` para `.env`, substitua todos os valores sintéticos e execute `docker compose up -d --build`. Nessa composição, somente o proxy web é publicado em `http://localhost:8080`; API, worker, PostgreSQL e Redis permanecem na rede interna.

Checks locais: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
