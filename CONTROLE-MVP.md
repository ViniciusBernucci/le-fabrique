# Controle do MVP — Le Fabrique

Atualizado em 2026-10-03 pelo FAC-012AA. Estado: IMPLEMENTAÇÃO INTERNA VERIFICADA / VALIDAÇÃO OPERACIONAL PENDENTE. MVP operacional não concluído. [BACKLOG.md](BACKLOG.md) registra aceite por ticket; [documentacoes/INDEX.md](documentacoes/INDEX.md) reúne evidências.

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

FAC-012A/B estão DONE com aceites registrados. FAC-012C–Z/AA e OPS-003/004/005/006 aguardam revisão humana; merge local não altera aceite. APIs de IA, extras, recarga e fallback pago permanecem proibidos.

## Estado do software e gates de operação

1. Transporte ampliado IMPLEMENTADO no W: diff completo/bundle até 8 MiB JSON/6 MiB raw com hashes/tamanhos, HTTP compatível e leituras bounded; não entrega arquivo ilimitado/repo inteiro nem trunca. Retenção/backup são operação manual, sem limpeza automática de evidências.
2. Recuperação de finalização IMPLEMENTADA no U: pedido UI/outbox FINALIZATION_ONLY reenvia journal parado/reconcile sem IA/novo writer. N/O/R/S/T preservam/reconciliam/retomam estado conhecido. Hard crash/writer desconhecido permanece bloqueado, sem reexecução por suposição; confirmação física pós-crash pertence operação manual, nunca liberação cega pela interface.
3. Auth/cota/WAITING_PROVIDER IMPLEMENTADOS no X; handoff IMPLEMENTADO no Y: alternativas conta/modelo explícitas na UI, stop/snapshot/restauração/contexto em outra worktree antes de próxima chamada. Reviewer read-only, budgets/lease/fence preservados; zero alternativas por padrão, máximo duas trocas sem gasto extra. Preflight real é manual; erro de segurança não vira fallback, unknown não libera writer.
4. Identidade por instalação IMPLEMENTADA no V: login/status/runtime usam stores privados e factory da rota UI atual, sem adapter global por provider/segredos do controle no ambiente. Autenticação/preflight de serviço manual. Perfil granular Claude e preflight IMPLEMENTADOS no AA; escrita exige prova nativa privada atual de UID/instalação/CLI/hash/política. Prova real não executada; nenhuma conta real desbloqueada.
5. Comandos de interface IMPLEMENTADOS para evidência conhecida: S solicita PAUSE/CANCEL e T retoma snapshot íntegro/parado, com confirmação explícita de orçamento da nova tentativa. Q exige aceite exato antes de DONE. Unknown/crash não oferecem retomada cega; recuperação de finalização segue item 2.
6. Gate documental técnico IMPLEMENTADO no Z: operador configura arquivos/seções, Developer atualiza documentos do projeto, gate estrutural exige mudanças/referências/hashes e Reviewer verifica conteúdo/critério. Snapshot posterior deve ser byte-equivalente; controle cruza evidência com manifesto final. Não substitui aceite humano ou prova operacional.

Evidência das lacunas: `apps/api/src/control/control.controller.ts`, `apps/api/src/orchestration/orchestration.controller.ts`, `apps/worker/src/main.ts`, `execution.processor.ts`, `developer-workflow.ts` e `apps/web/src/App.tsx`. O MVP não está concluído enquanto essas pendências persistirem.

## Passos manuais do responsável

Escolher/cadastrar piloto, autenticar clientes sob identidade de serviço, confirmar extras desligados, provisionar/ativar host worker/serviços, aplicar migrations, publicar Git/deploy e validar operação/backup/restauração. Não executados neste incremento. Piloto ausente não bloqueia desenvolvimento interno.

## Próxima etapa dependente do responsável

Prova oficial de confinamento/financeiro/identidade de serviço, piloto cadastrado e ensaio operacional. Código/gate de confinamento implementado no AA; documentação técnica implementada no Z. Não há outro ticket interno READY identificado nas lacunas atuais. N–Y integram recuperação, entrega ampliada, relatório/aceite, controles/retomada, identidades, espera e handoff configurado. Última evidência AA: 433 testes/checks, [relatório](documentacoes/runtime/2026-10-03-FAC-012AA-confinamento-claude.md). Um ticket READY e um writer; sem prova de serviço/provider/cobrança real.

Retomada deste desenvolvimento está em `feat/fac-012aa-claude-confinement`, `/home/vinicius/le-fabrique-fac-012aa`, com Z por ancestry e código AA `56f2e38`. Root `developer` permanece limpo em `745ce2d`; não houve merge/push/deploy. Pergunta sobre piloto/conta de serviço/financeiro permanece sem resposta; não inferir autorização ou elegibilidade.
