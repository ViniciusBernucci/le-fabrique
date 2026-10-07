# Estado e gates locais

Persistir um estado operativo nas evidências do ticket: ticket/path, revisão/branch/worktree, fase de coordenação, papel atual, autorizações aplicáveis, writer/quiescência, checks/gates e paths/hashes, ciclos de correção (0/2), próxima ação e histórico datado de transições. Não exigir ferramenta externa.

Fases de coordenação: ESPECIFICACAO → PRONTO → IMPLEMENTACAO → REVISAO → CORRECAO/REVALIDACAO se necessário → QA conforme critérios → AWAITING_HUMAN. INTEGRACAO/ENCERRAMENTO só se incluídos no pedido. BLOQUEADO informa condição de saída; NOT_RUN/NÃO APLICÁVEL justificam gates ausentes. São fases documentais, não novos enums de Ticket/Run/Attempt.

Pronto exige ticket executável; implementação exige código/revisão/docs/checks; revisão exige cobertura/achados da revisão exata; QA exige cenários observados quando pertinente; aceite exige decisão humana dessa revisão. Commit, checkbox ou mensagem do modelo não substituem gates. Mudança invalida somente evidências afetadas.

Após duas rodadas de correção, checkpoint/diagnóstico em vez de ciclo infinito. Se não há sessão independente, persistir o gate pendente. Não spawnar agentes por efeito da orquestração. Autorizações já dadas não exigem confirmação de rotina; merge/push/produção continuam sob autorização aplicável. Ao retomar, conferir SHA/patch/untracked/hash e stop antes de writer novo.
