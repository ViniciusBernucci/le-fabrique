# Operar e recuperar

Código operativo existe, ativação/eficácia no serviço são gates separados. [Infraestrutura local integral](infraestrutura/referencia-v2.3.md), [dimensionamento](infraestrutura/dimensionamento-vps.md), [execução/recuperação](execucao-e-recuperacao.md), [handoff](handoff.md), [backup](backup.md), [restore](restore.md), [deploy](deploy.md), [troubleshooting](troubleshooting.md), [observabilidade](observabilidade.md), [economia](economia.md), [incidentes](incidentes.md).

Um executor/um writer global. Pedido de pausa, heartbeat stale, lease vencida e fila vazia não provam parada. Não aplicar migrations/ativar worker enquanto quiescência desconhecida. Auth oficial fora de sandbox/controle; só fluxo oficial humano, sem OAuth como API nem auth mount para contornar cliente incompatível.

[AS-IS](../02-arquitetura/as-is.md) descreve Compose/worker/código real. Tenancy/broker/egress detalhados da proposta não equivalem a enforcement implementado. Snapshots/runbooks locais preservam parâmetros, procedimentos e revisões; metas de RPO/RTO/retention/recursos não são resultados medidos.
