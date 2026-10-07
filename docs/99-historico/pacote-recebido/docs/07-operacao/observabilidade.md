# Observabilidade e evidências

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Coletar fila/etapa, heartbeat/lease, processos, CPU/RAM/disco/OOM, duração ativa/espera, provider/modelo/versão, handoffs/retries, checks/docs e revisão aceita. Uso tem unidade/fonte/observed_at/reset nullable; não inventar percentuais ou reset. Painel mobile deve mostrar API/extras desligados.

Logs são limitados/sanitizados e autorizados por tenant/projeto; sem prompts completos, auth headers, tokens, dumps ou PII. Saída de IA recebe escape HTML/ANSI e nunca dispara comando administrativo.

Alertas/limiares propostos: disco livre <20%, RAM >85% sustentada 5min, OOM, heartbeat perdido; p95 API 1s para operações administrativas comuns é meta de ensaio. Valores não medidos nesta stack. Instrumentação real e canais/responsáveis de alerta estão pendentes.

## Proveniência

- [Observabilidade original](../99-historico/pdf-v2.1/recuperados/documentacoes/operacao/README.md)
- [Envelopes atuais](infraestrutura/dimensionamento-vps.md)
