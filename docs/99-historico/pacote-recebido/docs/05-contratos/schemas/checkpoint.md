# Checkpoint recuperável

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Campos mínimos planejados: schema_version; tenant/project/ticket/run/attempt; objetivo/aceite/escopo; base/code SHA; branch/workspace; fencing; stopped_confirmed e evidência externa de quiescência; patch/untracked artifacts e hashes; política de exclusão; checks/revisão/resultado; falhas/limitações; próximos passos; docs pendentes; provider/versão/modelo quando conhecido; motivo e uso com fonte/horário.

Checkpoint não contém auth/home/transcript privado. Commit não preserva untracked sozinho. Validar recuperabilidade e persistência antes de liberar lock anterior. Restore autoriza escopo e instalação do mesmo tenant, confere hashes/paths e evita reaplicar patch já presente.

Formato executável/schema final e compatibilidade de versões ainda são pendentes. Use o [template de handoff](../../00-governanca/templates/HANDOFF.md) para registro humano; não confundi-lo com schema de máquina.

## Proveniência

- [Handoff original](../../99-historico/pdf-v2.1/recuperados/documentacoes/handoff/README.md)
- [Procedimento atual](../../07-operacao/handoff.md)
