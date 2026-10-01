# Sandbox, worktree e snapshot sao limites diferentes

Worktree separa revisoes e escritores, mas nao protege credenciais do mesmo usuario. No FAC-007, `WorkspaceManager` cria o checkout detached na revisao exata; `SandboxRunner` aplica o limite de processo com cgroup e namespaces. A fixture comprovou que home, controle e Docker socket somem, em vez de confiar apenas em uma instrucao ao comando.

Lifecycle precisa pertencer ao cgroup. Matar somente o wrapper `systemd-run` poderia deixar filhos. O runner sinaliza a unidade com `KillMode=control-group`, escala para `SIGKILL` e consulta o estado antes de afirmar `stoppedConfirmed`. O teste do heartbeat verifica o efeito depois do retorno.

Snapshot e um terceiro limite: recuperabilidade. `SnapshotManager` combina patch binario com arquivos untracked, modos e hashes. Ele verifica todos os bytes antes de escrever e so restaura sobre worktree limpo no mesmo SHA. Commit ou patch sozinho nao recuperaria o untracked binario usado no teste.

No FAC-010C, o snapshot vira a fronteira do handoff. O contrato exige parada confirmada, captura nao anterior ao termino do processo e a mesma revisao-base. O destino recebe uma nova worktree e `SnapshotManager.restore` verifica manifesto/bytes antes da chamada ao segundo provider. A evidencia de origem foi reduzida a campos terminais; `providerSessionId`, mensagem e output bruto nem entram no pedido de handoff.
