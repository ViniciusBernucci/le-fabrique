# FAC-000 - Bootstrap TypeScript da fábrica

Status: PRONTO PARA REVISÃO

## Objetivo

Criar a fundação executável do monorepo aprovado no ADR-003 para iniciar o desenvolvimento da Le Fabrique.

## Atual e esperado

O repositório contém apenas planejamento. Ao final, deve possuir frontend React/Vite, API NestJS, worker Node.js, contratos Zod, PostgreSQL, Redis/BullMQ e Docker Compose, todos com TypeScript e checks reproduzíveis.

## Escopo permitido e proibido

Permitido: `apps/`, `packages/`, `infrastructure/`, arquivos de configuração na raiz e documentação do bootstrap.

Fora do escopo: provisionar VPS, autenticar provedores, executar clientes oficiais, autenticação administrativa, regras completas de tickets/runs, merge e deploy.

## Critérios de aceite verificáveis

- `npm ci`, lint, typecheck, testes e builds passam.
- `apps/web`, `apps/api`, `apps/worker`, `packages/contracts` e `packages/runtime` existem com responsabilidades separadas.
- Entradas HTTP e de fila usam schemas Zod compartilhados.
- API expõe liveness e readiness para PostgreSQL e Redis.
- Docker Compose valida e mantém PostgreSQL/Redis sem portas públicas na composição completa.
- Migração inicial do PostgreSQL é reproduzível e não contém segredos.

## Baseline e comandos de checks

Baseline: Node.js 22.20.0, npm 10.9.3, Docker CLI 29.7.2 e Compose 5.5.0. O daemon Docker local não estava acessível antes da implementação.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `docker compose config` e `docker compose -f compose.dev.yaml config`.

## Risco e orçamento

Risco R1. Dados somente sintéticos. Nenhuma API de IA, extra usage ou contratação. Um writer.

## Dependências

ADR-002 e ADR-003 aceitos. Não depende do piloto externo nem do provisionamento da VPS.

## Entregáveis e documentação afetada

Código do monorepo, configuração Docker, migration, README raiz, README de infraestrutura, índice, changelog, backlog, relatório de entrega e lesson técnica pertinente.

## Evidências e aceite

Evidências serão registradas no relatório de entrega. O ticket não será marcado DONE sem revisão e aceite humano.
