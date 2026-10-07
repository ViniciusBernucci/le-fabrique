# Contrato do Runtime Gateway

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Interface planejada: execute(request) → eventos + result; getStatus; getCapabilities; getUsage; cancel; resume. A semântica atual é canônica no [módulo runtime](../../03-modulos/runtime/README.md).

Request associa tenant/project/run/step/attempt, installation/workspace, revisão, context/instruction hashes, policy, fencing, deadline, profile e limites. Result normaliza status/exit code, revisão/diff/hashes/checks, timestamps, versão real e modelo/uso/session ID quando observáveis. billing_mode é distinto de tokens.

Resume nativo só se versão/sessão compatíveis; handoff sempre é nova tentativa. getUsage pode ser UNKNOWN. cancel precisa confirmar término externo. Erros herdados adicionais: CONTEXT_TOO_LARGE e UNSUPPORTED de capacidade; a v3 acrescenta UNSUPPORTED_ISOLATION. Preservar taxonomia ao definir schema real, sem confundir falta de capacidade com isolamento incompatível.

CLI JSONL não é prova de tools remotas. Não executar invocações históricas como se garantissem isolamento. Não guardar raciocínio privado do modelo.

## Proveniência

- [Contrato original pp.21–22](../../99-historico/pdf-v2.1/recuperados/documentacoes/runtime/README.md)
