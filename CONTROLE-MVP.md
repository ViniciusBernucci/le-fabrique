# Controle do MVP — Le Fabrique

Atualizado em 2026-10-03 pelo FAC-012V. Estado: EM DESENVOLVIMENTO. [BACKLOG.md](BACKLOG.md) registra aceite por ticket; [documentacoes/INDEX.md](documentacoes/INDEX.md) reúne evidências.

Escopo autorizado: concluir código/verificações internas sem piloto externo, integrar trabalho local na `developer` e preservar configuração pela interface. Aceite humano, push e implantação são distintos de implementação/merge local.

## O que já existe

| Área | Estado comprovado | Evidência |
|---|---|---|
| Stack | React/Vite, NestJS, worker Node/TS, PostgreSQL, Redis/BullMQ | ADR-003; manifests/checks |
| Projeto/objetivo | Cadastro, definição versionada, caminhos, contexto/checks aprovados e tickets READY | FAC-001A/003A/012I |
| Configuração IA | Interface para instalações, modelos, funções e proteções financeiras sem segredos/hardcode | FAC-011/012E–G |
| Snapshot da intenção | Evento READY congela projeto/definição/ticket com invariantes runtime | FAC-012A/B aceitos; OPS-003 |
| Execução | Consumer compõe checkout, workflow, rotas atuais, lease/fencing/checkpoint | FAC-012L `54bf483`; gate desligado |
| Checks/revisão | Baseline, regressões, Reviewer separado e correções limitadas | FAC-009/012G/L |
| Parada | AbortSignal em CLI/checks; systemd desconhecido não confirma parada | FAC-012K/L; testes Linux |
| Artefatos locais | Patch/untracked, manifesto/hash e restauração em bibliotecas | FAC-007; SnapshotManager |
| Resultados no painel | Histórico/checks/revisão/metadados/chamadas | FAC-012M `14ae5ba`; migration não aplicada |
| Integrações oficiais | Verificação/login Codex/GitHub, adapter Claude/handoff e PR sob gate | FAC-010A/B/C e FAC-011A/B/C/D; operação parcial |
| Infraestrutura | Compose controle/bancos e template host worker dedicado | OPS-005; serviço não instalado |
| Git local | D–J consolidados; K/L e OPS-005 integrados pelo OPS-006 após checks | ancestry/relatório OPS-006 |

FAC-012A/B estão DONE com aceites registrados. FAC-012C–V e OPS-003/004/005/006 aguardam revisão humana; merge local não altera aceite. APIs de IA, extras, recarga e fallback pago permanecem proibidos.

## O que falta no software

1. Transporte de artefatos grandes e retenção operacional: FAC-012P já mostra diff completo e baixa patch/untracked do último snapshot dentro do teto explícito 64 KiB, sem truncar. Retenção/backup e entrega além do teto seguem pendentes; hashes/tamanhos são verificados.
2. Recuperação de finalização IMPLEMENTADA no U: pedido UI/outbox FINALIZATION_ONLY reenvia journal parado/reconcile sem IA/novo writer. N/O/R/S/T preservam/reconciliam/retomam estado conhecido. Hard crash/writer desconhecido permanece bloqueado, sem reexecução por suposição; confirmação física pós-crash pertence operação manual, nunca liberação cega pela interface.
3. Ligar auth/cota/WAITING_PROVIDER e handoff ao consumer, usando configuração/elegibilidade atuais e parada comprovada. As bibliotecas não constituem esse fluxo integrado.
4. Identidade por instalação IMPLEMENTADA no V: login/status/runtime usam stores privados e factory da rota UI atual, sem adapter global por provider/segredos do controle no ambiente. Autenticação/preflight de serviço manual. Escrita Claude bloqueada; falta provar confinamento granular para torná-la elegível.
5. Comandos de interface IMPLEMENTADOS para evidência conhecida: S solicita PAUSE/CANCEL e T retoma snapshot íntegro/parado, com confirmação explícita de orçamento da nova tentativa. Q exige aceite exato antes de DONE. Unknown/crash não oferecem retomada cega; recuperação de finalização segue item 2.
6. Atualizar/gatear documentação técnica dentro do repositório externo conforme regras do projeto. FAC-012Q já gera relatório de entrega com evidências e gate do aceite, mas esse relatório não modifica README/ADRs/lessons do projeto nem comprova semanticamente todos os critérios.

Evidência das lacunas: `apps/api/src/control/control.controller.ts`, `apps/api/src/orchestration/orchestration.controller.ts`, `apps/worker/src/main.ts`, `execution.processor.ts`, `developer-workflow.ts` e `apps/web/src/App.tsx`. O MVP não está concluído enquanto essas pendências persistirem.

## Passos manuais do responsável

Escolher/cadastrar piloto, autenticar clientes sob identidade de serviço, confirmar extras desligados, provisionar/ativar host worker/serviços, aplicar migrations, publicar Git/deploy e validar operação/backup/restauração. Não executados neste incremento. Piloto ausente não bloqueia desenvolvimento interno.

## Próximo incremento

Provider/confinamento/handoff, gate de documentação técnica e transporte maior. N–V integram recuperação, journal/bundle limitado, relatório/aceite, interrupções, controles, retomada e identidade por instalação. Última evidência V: 380 testes/checks, [relatório](documentacoes/runtime/2026-10-03-FAC-012V-identidades-instalacoes.md). Um ticket READY e um writer; sem prova de serviço/provider/cobrança real.
