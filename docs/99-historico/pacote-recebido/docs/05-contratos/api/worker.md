# Protocolo interno do worker

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

| Endpoint proposto | Semântica |
|---|---|
| POST /workers/register | Onboarding restrito de identidade de serviço |
| POST /workers/{id}/heartbeat | Saúde e renovação conforme ownership |
| POST /workers/{id}/jobs/claim | Claim transacional idempotente |
| POST /attempts/{id}/events | Eventos limitados e deduplicados |
| POST /attempts/{id}/checkpoint | Preservar estado recuperável validado |
| POST /attempts/{id}/complete | Resultado associado à tentativa/revisão |

Payloads versionados levam tenant/project/run/attempt, sequence/event_id, version e fencing. Worker não escolhe repo/URL/comando do host a partir de output do modelo. Token do worker não chega a runtime, broker ou sandbox. Heartbeat 15s/lease 90s são propostas a ensaiar; interromper antes da expiração com margem.

Schemas completos e autorização de cada rota dependem de implementação. Eventos velhos não alteram ownership/budget/política/aceite. Fencing não substitui término do processo. Uploads têm limite de tamanho/hash/paths, sanitização e ownership.

## Proveniência

- [Worker API no PDF pp.24–25](../../99-historico/pdf-v2.1/recuperados/documentacoes/operacao/README.md)
- [Extensão operacional v3](../../07-operacao/execucao-e-recuperacao.md)
