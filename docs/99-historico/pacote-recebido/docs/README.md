# Manual Vivo da Fábrica de Software

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## O que é e qual problema resolve

A Fábrica organiza trabalho de desenvolvimento executado com agentes de IA. Um pedido vira ticket com escopo e critérios; uma execução produz código, checks, revisão e documentação; uma pessoa aceita a revisão específica. O objetivo é reduzir retrabalho e aproveitar assinaturas existentes, com limites e recuperação explícitos.

Neste espelho existe **planejamento documental**. Não foram encontrados frontend, backend, worker, migrations ou CI da aplicação. Toda descrição de funcionamento abaixo é o desenho pretendido. O conteúdo multi-tenant é uma proposta posterior, não uma liberação comercial.

## Como funciona em dois minutos

1. O usuário cadastra projeto e ticket com objetivo, caminhos autorizados e critérios verificáveis.
2. A API confirma identidade/tenant/projeto e o orquestrador cria uma Run recuperável.
3. O Context Builder seleciona fontes da revisão concedida e registra hashes/omissões.
4. Um worker recebe o job; o Executor prepara a sandbox e garante um único writer.
5. O runtime autentica o cliente oficial do provider; as ferramentas do modelo passam pelo broker e executam apenas na sandbox.
6. O executor coleta resultados, roda checks e encaminha a uma sessão independente de revisão.
7. Até duas rodadas de correção; documentação atual e registro de entrega passam pelo gate.
8. AWAITING_HUMAN aguarda aceite da revisão exata. Novo diff invalida aceite e evidências afetadas.

Se o provider atingir limite, a fábrica confirma término do writer e preserva checkpoint, patch e arquivos não rastreados. Outro provider elegível do mesmo tenant retoma em uma tentativa nova. Sem provider disponível, aguarda; não habilita gasto extra.

## Arquitetura em uma leitura

React é o painel. NestJS organiza o plano de controle como monólito modular quando adequado. PostgreSQL persiste identidade/workflow; Redis participa de fila/cache, com outbox transacional no banco. Worker Node/TypeScript e Executor administram execução. Runtimes autenticados ficam separados do código do projeto, mesmo na mesma VPS. Inferência ocorre nos fornecedores externos.

[Contexto C4](02-arquitetura/contexto.md) mostra pessoas e sistemas externos; [containers C4](02-arquitetura/containers.md) mostra unidades de execução e armazenamento; [componentes C4](02-arquitetura/componentes.md) explica responsabilidades internas. Container C4 não significa necessariamente container Docker.

## Módulos e features

Projetos e tickets definem trabalho; runs/orchestrator coordenam estados; worker/executor/sandbox impõem lifecycle; runtime/providers escolhem instalações elegíveis; context builder limita entrada; tool broker controla ações; documentation gate e approvals vinculam conclusão a evidência; observabilidade/economia mostram resultados e desconhecidos. [Catálogo de módulos](03-modulos/README.md).

Features descrevem comportamento atual pretendido e critérios. FAC e LF-MT permanecem IDs de backlog, não evidência de feature entregue. [Catálogo de features](04-features/README.md).

## Limites importantes para entender o desenho

Uma VPS é ponto único de falha; backup fica fora dela. Um executor global inicial e um writer por workspace. Container comum é perfil de piloto próprio com dados sintéticos; código hostil de terceiros requer avaliação de perfil mais forte. Mediação exclusiva de tools pelo broker é condição a provar: se o cliente não suportar, provider fica desabilitado. Não existe garantia universal contra kernel/root comprometido.

## Onde continuar

- [Como ler o sistema](LEIA-ME-PRIMEIRO.md): trilhas por objetivo.
- [Visão geral](01-visao-geral/README.md): escopo, objetivos e glossário.
- [Arquitetura](02-arquitetura/README.md): C4, dados, fluxos e segurança.
- [Contratos](05-contratos/README.md): API, eventos, filas, runtime e schemas.
- [Decisões](06-decisoes/README.md): razões e status de ADRs.
- [Operação](07-operacao/README.md): deploy, backup, restore e incidentes planejados.
- [Desenvolvimento](08-desenvolvimento/README.md): piloto, plano, testes e contribuição.
- [Entregas](09-entregas/README.md): o que mudou, com evidências reais.
- [Lessons](10-lessons/README.md): conhecimento aplicado, sem exemplos de implementação inventados.
- [Governança](00-governanca/README.md): política, auditoria, fontes e mapa de migração.

Este manual resume e aponta fontes canônicas. Contratos detalhados não devem ser copiados para vários capítulos.

## Proveniência

- [Planejamento v2.1](99-historico/originais/sources/README.md)
- [Proposta multi-tenant](99-historico/originais/output/le-fabrique-multitenant/README.md)
- [Contratos v3](99-historico/originais/output/le-fabrique-multitenant/ESPEC-MVP.md)
