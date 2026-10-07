# Dispatch, outbox e filas

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Persistir mudança de estado e registro outbox na mesma transação. Publicação na fila Redis pode repetir: consumidores revalidam a cadeia tenant/projeto/run/attempt/instalação, version, fencing e ownership antes de qualquer efeito.

Claim é transacional; um writer por workspace. Evento duplicado não repete efeito; resposta externa RESULT_UNKNOWN exige reconciliação antes de retry. Namespace Redis organiza chaves, mas não autoriza acesso. Cache privado inclui tenant/projeto/revisão/política.

Nome de fila, biblioteca (por exemplo BullMQ), dead-letter/retry/dedupe store e schema físico não constam como decisão comprovada. Definir e testar em ticket específico. TTL da capability nunca ultrapassa lease/deadline; falta de política falha fechado.

## Proveniência

- [Dados e fila](../../03-modulos/tenant-isolation/README.md)
- [Workflow](../../07-operacao/execucao-e-recuperacao.md)
