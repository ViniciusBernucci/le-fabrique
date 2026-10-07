# Handoff e troca de provider

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

1. Bloquear novas ferramentas e etapas. Cancelar árvore/cgroup se pausa não for suportada.
2. Confirmar quiescência externamente; lease expirado ou fencing não comprovam morte do writer.
3. Coletar base/code SHA, status, diff/patch (binário quando necessário) e untracked; excluir secrets/dependências. Supervisor faz snapshot mesmo sem resumo final da IA.
4. Persistir artefatos imutáveis/hash/checkpoint e testar recuperabilidade. Commit WIP somente quando permitido e revisado; não cobre untracked sozinho.
5. Liberar lock anterior e emitir novo fencing. Nova attempt/sandbox/sessão; revalidar membership/policy/grant/instalação do mesmo tenant.
6. Novo provider confere revisão, patch e hashes, não reaplica conteúdo já presente e roda checks pertinentes.
7. Registrar motivo, origem/destino, tempo, uso conhecido/desconhecido, pendências e docs. Após limite proposto de dois handoffs, pausar com diagnóstico.

Sem prova de término, BLOCKED_RECOVERY. Sem provider elegível, WAITING_PROVIDER. Auth/home/transcript privado não são transferidos. [Schema](../05-contratos/schemas/checkpoint.md), [template humano](../00-governanca/templates/HANDOFF.md) e [operação completa](execucao-e-recuperacao.md).

## Proveniência

- [Fonte recuperada p.23](../99-historico/pdf-v2.1/recuperados/documentacoes/handoff/README.md)
