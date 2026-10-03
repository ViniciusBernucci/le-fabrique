# Lessons

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
