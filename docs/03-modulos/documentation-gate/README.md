# Gate documental

IMPLEMENTADO no código base `a2cc5e0`; verificação operacional NÃO VERIFICADA nesta migração. Responsabilidade lógica, não nova classe/microserviço.

## Finalidade e limites

Vincular documentos e revisão semântica ao snapshot final.

## Fluxo e comportamento

Política configurada no projeto → arquivos atualizados → gate bounded após stop/checks → Reviewer → conferir manifesto imutável → persistir evidência para aceite.

Exemplo didático: ticket com critério “validar um campo” só avança com a base/definição/checks aprovados; request inválido não vira comando autorizado. O exemplo não é execução desta migração.

## Estados, dados e regras

MAX_FILE_BYTES=262144; recusa unsafe/unchanged/placeholders/seções vazias/base/checks ausentes. Gate não entende sozinho semântica e não marca DONE. Paths são configurados, não hardcoded documentacoes. Veja [estados por entidade](../../05-contratos/schemas/workflow.md) e [contratos canônicos](../../05-contratos/README.md).

## Falhas, recuperação e segurança

Payload/versão/base inválidos são recusados antes de efeito pertinente; auth/cota não autorizam fallback pago. Writer unknown permanece bloqueado; não repetir execução ou liberar lease por idade. Credenciais não entram em DTO/contexto/log/artefato; API não executa código do projeto. Limites de cada contrato e gates de provider continuam necessários.

## Código e evidência

[apps/worker/src/documentation-gate.ts](../../../apps/worker/src/documentation-gate.ts) e [apps/api/src/orchestration/run-delivery.service.ts](../../../apps/api/src/orchestration/run-delivery.service.ts). Testes versionados ao lado dessas implementações e evidências por FAC-012Z/Q no [histórico](../../09-entregas/README.md). Não reexecutados aqui. [ADR-003 aceito](../../06-decisoes/ADR-003-stack-typescript.md) e [feature relacionada](../../04-features/documentation-approval.md).

## Limitações e direção posterior

[AS-IS versus alvo](../../02-arquitetura/as-is.md) separa controles atuais de tenancy/RLS/broker propostos. Presença de implementação/teste versionado não comprova instalação ou eficácia sob UID de serviço.
