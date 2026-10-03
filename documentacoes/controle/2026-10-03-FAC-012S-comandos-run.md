# FAC-012S — Comandos administrativos de execução

Estado: EM VERIFICAÇÃO; não aceito. Baseline `25ab4a4` (READY sobre `4be88df`). Um writer na worktree isolada, providers sintéticos, nenhuma operação em serviço/banco/fila real.

## Checkpoint e diagnóstico após duas rodadas

Typecheck inicial passou. Primeiro formatter/lint detectou dependências de efeito React sem uso real; segunda rodada detectou captura de objeto `attempt` contra dependência específica `attempt.id`. Não é falha do baseline. Diagnóstico: registrar pedido em state e executar via effect com IDs/versões primitivas estáveis evita repetição pelo polling; confirmação ligada à versão. Verificação completa ainda pendente neste checkpoint. Nenhum sucesso declarado ou evidência operacional inventada.

Código/checks/SHA final, diffs, limites e rollback serão registrados depois da verificação.
