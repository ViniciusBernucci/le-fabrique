# Configuração e integrações

IMPLEMENTADO no código base `a2cc5e0`; verificação operacional NÃO VERIFICADA nesta migração. Responsabilidade lógica, não nova classe/microserviço.

## Finalidade e limites

Persistir contas/instalações, modelos, agentes, skills de projeto e GitHub sem segredos.

## Fluxo e comportamento

Contas/Integrações IA/Equipes → modal com rascunho → salvar versionado; verificar/login/PR são pedidos explícitos persistidos com outbox.

Exemplo didático: ticket com critério “validar um campo” só avança com a base/definição/checks aprovados; request inválido não vira comando autorizado. O exemplo não é execução desta migração.

## Estados, dados e regras

FactorySettings singleton JSON; skills não são instaladas/executadas pelo cadastro. PR exige preparar/aprovar payload exato; código não faz merge. Veja [estados por entidade](../../05-contratos/schemas/workflow.md) e [contratos canônicos](../../05-contratos/README.md).

## Falhas, recuperação e segurança

Payload/versão/base inválidos são recusados antes de efeito pertinente; auth/cota não autorizam fallback pago. Writer unknown permanece bloqueado; não repetir execução ou liberar lease por idade. Credenciais não entram em DTO/contexto/log/artefato; API não executa código do projeto. Limites de cada contrato e gates de provider continuam necessários.

## Código e evidência

[apps/api/src/settings/settings.service.ts](../../../apps/api/src/settings/settings.service.ts) e [apps/web/src/SettingsPanel.tsx](../../../apps/web/src/SettingsPanel.tsx). Testes versionados ao lado dessas implementações e evidências por FAC-011/013–019/023/026 no [histórico](../../09-entregas/README.md). Não reexecutados aqui. [ADR-003 aceito](../../06-decisoes/ADR-003-stack-typescript.md) e [feature relacionada](../../04-features/control-settings.md).

## Limitações e direção posterior

[AS-IS versus alvo](../../02-arquitetura/as-is.md) separa controles atuais de tenancy/RLS/broker propostos. Presença de implementação/teste versionado não comprova instalação ou eficácia sob UID de serviço.

## Referência integral local

[Detalhes por incremento com nota editorial](referencia-v2.3.md). Evidências/contratos históricos permanecem completos; afirmações de estado vencidas são delimitadas pela auditoria.
