# OPS-005 — Worker confiável no host da VPS

Status: READY

## Objetivo

Preparar o processo worker Node/TypeScript para rodar como serviço dedicado do host na mesma VPS, deixando PostgreSQL, Redis, API e painel em Docker Compose. O `SandboxRunner` exige `systemd-run --user`/namespaces, que não existem no container worker atual; a imagem também não inclui as CLIs oficiais/Git nem recebe os diretórios de checkout. Não executar nem provisionar o serviço neste ticket.

## Critérios de aceite

1. O serviço Compose por padrão não inicia um consumidor de execução que atualmente apenas simula o workflow; o código não pode marcar tickets READY como `VALIDATING` via fixture.
2. O Compose mantém API e Redis acessíveis ao worker host somente por bind `127.0.0.1`; portas não são publicadas em interfaces externas.
3. Entregar unit systemd genérico para o worker host com usuário dedicado, `HOME`/estado sob `StateDirectory`, env file externo ao repositório, sem tokens/modelos/contas embutidos e sem `privileged`/capabilities amplas.
4. O serviço host não inicia execução real de ticket: checkout/DeveloperWorkflow continuam desligados até ticket de integração próprio e gates operacionais/aceites cumpridos.
5. Documentar bootstrap manual futuro, requisitos de `loginctl enable-linger` para `systemd-run --user`, caminhos de instalação, acessos locais e rollback sem executar comandos administrativos.
6. Atualizar ADR-002/README de infraestrutura somente como detalhamento compatível da VPS única; manter a stack React/Nest/worker TS/PostgreSQL/Redis+BullMQ e o Docker Compose da control plane.
7. `docker compose config --quiet`, verificação sintática do unit systemd quando disponível, lint, typecheck, testes, build e `git diff --check` passam sem iniciar/recriar containers, tocar banco/fila, instalar cliente ou autenticar provider.

## Baseline e escopo

Base `ce93b20440c3f7ecc216ae6513396596cdf9a76e` em `developer`. Alvos principais: `compose.yaml`, `apps/worker/src/main.ts`, processador de orquestração, `infrastructure/systemd/`, `.env.production.example`, README e documentação `infraestrutura`/`operação`/`arquitetura`. Relato de implementação será `documentacoes/infraestrutura/2026-10-03-OPS-005-worker-host-sandbox.md`.

## Provider, efeitos e limites

Nenhum provider de IA elegível/usado; apenas testes determinísticos. Não acessar banco/Redis reais, não ler logs/env do serviço ativo, não executar setup systemd, não parar/atualizar serviços, não instalar CLIs, não criar piloto, não fazer migration/push/deploy. A composição existente contém worker container em execução sem bind mounts para o checkout; ela não será reiniciada neste ticket.

Limite: incremento de infraestrutura pequeno, até duas rodadas de correção. Evidência sintética não prova identidade, keyring, sandbox ou uso financeiro da futura VPS.
