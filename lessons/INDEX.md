# Lessons

FAC-012V aplica identidade por instalação distinta de confinamento: [perfis de cliente](perfis-permissao-cliente-cli.md).

FAC-012U aplica retry de entrega distinto de execução: [leases/fencing](leases-fencing-checkpoints.md).

FAC-012T aplica retomada por estado externo/baseline pré-restore: [snapshots](sandbox-worktree-snapshot.md).

FAC-012S aplica intenção administrativa versus stop físico e confirmação por versão: [leases/fencing](leases-fencing-checkpoints.md).

FAC-012R aplica término unknown sticky e separa cancelamento comprovado de preservação de evidência; exemplo na lesson lifecycle, [evidências](../documentacoes/operacao/2026-10-03-FAC-012R-snapshot-interrupcao.md).

FAC-012Q aplica revisão exata de patch/resultado/documentação e baseline no gate; [evidências](../documentacoes/controle/2026-10-03-FAC-012Q-documentacao-aceite-entrega.md), exemplos na lesson baseline/review.

FAC-012P aplica integridade de bytes além de schemas e distingue limite/scan de garantia universal; exemplo na lesson contratos, [evidências](../documentacoes/controle/2026-10-03-FAC-012P-artefatos-painel.md).

FAC-012O aplica journal antes de HTTP e distingue recuperar finalização de reexecutar IA; [evidências](../documentacoes/operacao/2026-10-03-FAC-012O-journal-resultados.md), exemplo na lesson leases/fencing.

FAC-012N amplia a lesson de leases/fencing com reconciliação serializável sem retry de IA; [evidências](../documentacoes/operacao/2026-10-03-FAC-012N-reconciliacao-checkpoint.md).

FAC-012M aplica DTO estrito/minimizado com desconhecidos explícitos e evidência imutável sem liberar writer; exemplos nas lessons de contratos e leases, [relatório](../documentacoes/controle/2026-10-03-FAC-012M-resultados-execucao-painel.md).

OPS-006 atualiza a lesson de sandbox/worktree com identidade do user manager e separação entre integração Git e ativação operacional; [evidências](../documentacoes/operacao/2026-10-03-OPS-006-integracao-local-controle-mvp.md).

FAC-012L aplica heartbeat/quiescência, lifecycle CLI e checkout confiável ao consumer gated; os conceitos existentes foram atualizados, sem criar lessons duplicadas. [Evidências](../documentacoes/operacao/2026-10-03-FAC-012L-consumer-execucao-real.md).
Documentos de conceitos serão preenchidos conforme implementação real. Este kit é planejamento; não inventa exemplos como se executados. Usar templates/LESSON.md e incluir links de revisão/entrega. Conceitos previstos: lifecycle CLI, leases/fencing, worktree/snapshot, contexto determinístico, idempotência, isolamento e cota observada.

- [Contratos de runtime no monorepo TypeScript](contratos-runtime-monorepo.md)
- [Outbox idempotente e versão otimista](outbox-idempotencia.md)
- [Heartbeat e parada conservadora](worker-heartbeat-quiescencia.md)
- [Perfis de permissao para clientes CLI](perfis-permissao-cliente-cli.md)
- [Lifecycle seguro de um cliente CLI](lifecycle-processo-cli.md)
- [Contexto deterministico e limites conservadores](contexto-deterministico-limites.md)
- [Sandbox, worktree e snapshot sao limites diferentes](sandbox-worktree-snapshot.md)
- [Lease, fencing e checkpoint cobrem falhas diferentes](leases-fencing-checkpoints.md)
- [Baseline, regressao e review sao sinais diferentes](baseline-regressao-review.md)
- [Definicao de projeto e compilacao com fronteiras confiaveis](definicao-projeto-configuravel.md)
- [Checkout confiavel separa credencial e conteudo externo](checkout-confiavel.md)
