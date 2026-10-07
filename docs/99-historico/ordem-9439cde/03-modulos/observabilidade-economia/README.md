# Observabilidade e economia

IMPLEMENTADO no código base `a2cc5e0`; verificação operacional NÃO VERIFICADA nesta migração. Responsabilidade lógica, não nova classe/microserviço.

## Finalidade e limites

Mostrar estado operacional e uso sem inventar métricas ou cobrança.

## Fluxo e comportamento

GET operation minimizado → heartbeat/índice/writer/pausa; eventos por projeto com cursor persistido/SSE/fallback HTTP; resultados mostram uso nullable.

Exemplo didático: ticket com critério “validar um campo” só avança com a base/definição/checks aprovados; request inválido não vira comando autorizado. O exemplo não é execução desta migração.

## Estados, dados e regras

Usage e chamadas no relatório JSON; não há Ledger relacional ou quotas completas. Home tem indicadores demonstrativos; não confundir com estado da fábrica. Veja [estados por entidade](../../05-contratos/schemas/workflow.md) e [contratos canônicos](../../05-contratos/README.md).

## Falhas, recuperação e segurança

Payload/versão/base inválidos são recusados antes de efeito pertinente; auth/cota não autorizam fallback pago. Writer unknown permanece bloqueado; não repetir execução ou liberar lease por idade. Credenciais não entram em DTO/contexto/log/artefato; API não executa código do projeto. Limites de cada contrato e gates de provider continuam necessários.

## Código e evidência

[apps/api/src/orchestration/operation-status.service.ts](../../../apps/api/src/orchestration/operation-status.service.ts) e [apps/api/src/orchestration/project-events.service.ts](../../../apps/api/src/orchestration/project-events.service.ts). Testes versionados ao lado dessas implementações e evidências por FAC-012AD/AE/AG/M no [histórico](../../09-entregas/README.md). Não reexecutados aqui. [ADR-003 aceito](../../06-decisoes/ADR-003-stack-typescript.md) e [feature relacionada](../../04-features/usage-dashboard.md).

## Limitações e direção posterior

[AS-IS versus alvo](../../02-arquitetura/as-is.md) separa controles atuais de tenancy/RLS/broker propostos. Presença de implementação/teste versionado não comprova instalação ou eficácia sob UID de serviço.
