# La fabrique — Fábrica de Software

[Abra o Manual Vivo](docs/01-README.md) para entender fluxo, arquitetura, módulos e limites. [LEIA-ME-PRIMEIRO](docs/00-LEIA-ME-PRIMEIRO.md) organiza as trilhas; [índice completo](docs/02-INDEX.md) localiza arquivos.

React + TypeScript + Vite; API NestJS; worker Node/TypeScript separado; PostgreSQL e Redis/BullMQ, na mesma VPS. A API não executa clientes, builds ou testes. Assinaturas oficiais primeiro, APIs de IA/extras/recarga/fallback pago desligados.

Código existe no monorepo. Tenancy/RLS/broker são propostas posteriores, sem eficácia comprovada. [Estado conferido em a2cc5e0](docs/02-arquitetura/01-as-is.md) distingue código, proposta e validação operacional. Aceites FAC continuam no [backlog real](docs/08-desenvolvimento/09-backlog.md); [changelog](docs/04-CHANGELOG.md) preserva cronologia.

## Desenvolvimento

[Setup e comandos reais](docs/08-desenvolvimento/01-ambiente-local.md). Requer Node 22.20.0, npm 10.9.3 e Docker Compose. Checks de software: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Migrations/ativação são ações explícitas separadas; não são parte da reorganização.

## Documentar e revisar

Abrir as [duas políticas](docs/00-governanca/00-README.md). Novas entregas em docs/09-entregas; módulos/contratos atuais e lessons aplicadas acompanham a alteração. [Prompt de entrega](prompts/PROMPT-ENTREGA.md), [prompt mestre de migração](prompts/PROMPT-MESTRE-MIGRACAO.md), [guia de integração](docs/00-governanca/03-GUIA-DE-INTEGRACAO.md).

Validação: `python3 scripts/validar-documentacao.py`. Esse comando verifica links, anchors, fences e hashes; revisão semântica e aceite humano continuam necessários. [Entrega DOC-MV-001](docs/09-entregas/2026/2026-10-07-DOC-MV-001-migracao-manual-vivo.md).

## Skills do projeto

As versões adaptadas para a La fabrique estão em [skills/](skills/00-perfil-la-fabrique.md). Guias de agentes exigem leitura explícita dessas fontes; descoberta automática não foi verificada. Consulte o [catálogo de papéis](docs/00-governanca/05-fontes-carregamento.md#skills-adaptadas-para-a-fábrica).
