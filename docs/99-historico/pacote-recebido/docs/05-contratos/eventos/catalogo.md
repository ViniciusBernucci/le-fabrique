# Eventos planejados

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

| Evento normalizado da base | Significado pretendido |
|---|---|
| started | Tentativa iniciou sob perfil autorizado |
| progress | Informação limitada, sem autoridade administrativa |
| checkpoint | Pedido/registro de estado validado pelo supervisor |
| usage_observed | Métrica com fonte e horário, nullable |
| limit_observed | Limite observado, não inferido de tokens |
| artifact_ready | Artefato validado por path/hash/tamanho/escopo |
| process_exited | Encerramento observado, não sucesso automático |
| finished | Resultado normalizado, sem promover DONE |

Envelope: schema_version, attempt, event_id/sequence, revisão, timestamps, fencing e payload limitado. Deduplicar por attempt/event_id e validar sequência conforme contrato real. Eventos da IA são dados não confiáveis; não alteram tenant, instalação, política ou cobrança.

Schemas JSON, ordenação em crash, tipos de timestamp e política de lacunas/replay ainda precisam ser definidos. Eventos como run-started citados em exemplos da conversa não foram comprovados no código nem substituem os nomes da base acima.

## Proveniência

- [Eventos v2.1](../../99-historico/pdf-v2.1/recuperados/documentacoes/runtime/README.md)
