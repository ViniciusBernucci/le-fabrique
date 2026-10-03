# Controle do MVP — Le Fabrique

Atualizado em 2026-10-03 pelo FAC-012S. Estado: EM DESENVOLVIMENTO. [BACKLOG.md](BACKLOG.md) registra aceite por ticket; [documentacoes/INDEX.md](documentacoes/INDEX.md) reúne evidências.

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

FAC-012A/B estão DONE com aceites registrados. FAC-012C–S e OPS-003/004/005/006 aguardam revisão humana; merge local não altera aceite. APIs de IA, extras, recarga e fallback pago permanecem proibidos.

## O que falta no software

1. Transporte de artefatos grandes e retenção operacional: FAC-012P já mostra diff completo e baixa patch/untracked do último snapshot dentro do teto explícito 64 KiB, sem truncar. Retenção/backup e entrega além do teto seguem pendentes; hashes/tamanhos são verificados.
2. Recuperação explícita de jobs FAILED/crash abrupto e retomada segura. FAC-012N reconcilia checkpoint parado/complete; O preserva pré-API em journal; R captura progresso/snapshot em AbortSignal com parada comprovada. Crash abrupto/writer desconhecido permanece bloqueado, sem reexecução por suposição.
3. Ligar auth/cota/WAITING_PROVIDER e handoff ao consumer, usando configuração/elegibilidade atuais e parada comprovada. As bibliotecas não constituem esse fluxo integrado.
4. Isolar credenciais por instalação para múltiplas contas. Interface configura instalações, mas runtime ainda usa um adapter por provider sob a mesma identidade. Provar confinamento Claude antes de escrita elegível.
5. Completar retomada pela interface. FAC-012S já solicita PAUSE/CANCEL, worker confirma stop/preserva snapshot antes de concluir; PAUSED manual distinto de PAUSED_LIMIT. FAC-012Q exige aceite de resultado+bundle+documento exatos antes de DONE. Recovery/retomada permanecem pendentes.
6. Atualizar/gatear documentação técnica dentro do repositório externo conforme regras do projeto. FAC-012Q já gera relatório de entrega com evidências e gate do aceite, mas esse relatório não modifica README/ADRs/lessons do projeto nem comprova semanticamente todos os critérios.

Evidência das lacunas: `apps/api/src/control/control.controller.ts`, `apps/api/src/orchestration/orchestration.controller.ts`, `apps/worker/src/main.ts`, `execution.processor.ts`, `developer-workflow.ts` e `apps/web/src/App.tsx`. O MVP não está concluído enquanto essas pendências persistirem.

## Passos manuais do responsável

Escolher/cadastrar piloto, autenticar clientes sob identidade de serviço, confirmar extras desligados, provisionar/ativar host worker/serviços, aplicar migrations, publicar Git/deploy e validar operação/backup/restauração. Não executados neste incremento. Piloto ausente não bloqueia desenvolvimento interno.

## Próximo incremento

Retomada segura/recovery, seguidos de provider/handoff/identidades e gate de documentação técnica. N–S integram reconciliação, journal, bundle limitado, relatório/aceite exato, interrupções e comandos administrativos. Última evidência S: 336 testes/checks, [relatório](documentacoes/controle/2026-10-03-FAC-012S-comandos-run.md). Um ticket READY e um writer; sem prova de serviço/provider/cobrança real.
