---
name: orquestrador-fluxo-ia
description: Coordena o fluxo local da La fabrique de ticket READY até evidências e aceite, preservando autorização e um writer. Use para continuar uma tarefa; não invoca agentes nem ferramentas externas automaticamente.
---

# Orquestrador local

Leia o [perfil da La fabrique](../00-perfil-la-fabrique.md) e as políticas ali indicadas antes de aplicar esta skill. 

Leia ticket, revisão e [estado e gates](references/estado-e-gates.md). Determine a próxima fase pela evidência existente. Reuse checkpoints e autorizações; não reiniciar o fluxo só porque mudou a sessão.

Roteie conforme a tarefa: tech-lead para lacunas de especificação; worktree-planner somente se isolamento precisar de plano; implementador para incremento; revisor-de-codigo para gate técnico; revisor-de-qa para critérios funcionais; fechar-entrega para docs/commit autorizado. Skills são papéis, não permissão para spawn. Delegação requer autorização aplicável; sem sessão independente, registrar gate pendente, não aprovar por conta própria.

Não aguardar seleção externa de tarefa, criação manual obrigatória de worktree ou publicação de resumo em serviço ausente. Git local é suficiente para planejar/registrar; ações externas só quando solicitadas e disponíveis.

Correções contra critérios/achados ficam no escopo já autorizado. Pedido apenas de revisão termina com achados. Pedido para implementar/corrigir mantém autorização para as correções pertinentes, sem novas confirmações de rotina. Revalidar evidências afetadas após novo diff. Até duas rodadas de correção por incremento, depois checkpoint e diagnóstico; não loop infinito.

Integrar/limpar somente quando revisão exigida, quiescência, trabalho preservado e autorização aplicável estiverem comprovados. developer é base local observada, não proibir main/master universalmente nem escolher branch pela ferramenta. Push/PR/deploy separados por escopo/autorização; não exigir publicação para considerar documentação entregue.

Persistir fase, revisão, gates, evidências, bloqueios e próxima ação nas evidências do ticket. Final pode ser AWAITING_HUMAN ou checkpoint parcial; não chamar fluxo concluído/DONE sem aceite humano exato.
