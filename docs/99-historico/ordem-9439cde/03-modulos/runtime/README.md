# Runtime de clientes oficiais

IMPLEMENTADO no código base `a2cc5e0`; verificação operacional NÃO VERIFICADA nesta migração. Responsabilidade lógica, não nova classe/microserviço.

## Finalidade e limites

Executar/cancelar clientes e normalizar resultados sem presumir sucesso.

## Fluxo e comportamento

Adapter validado → prompt stdin/argv → eventos limitados → término da árvore → resultado tipado; Reviewer read-only. Perfil Codex/Claude é próprio por versão.

Exemplo didático: ticket com critério “validar um campo” só avança com a base/definição/checks aprovados; request inválido não vira comando autorizado. O exemplo não é execução desta migração.

## Estados, dados e regras

Codex e Claude implementados; uso/modelo efetivo nullable; native resume unsupported conforme adapter. Auth/store segregado por instalação não comprova broker remoto. Veja [estados por entidade](../../05-contratos/schemas/workflow.md) e [contratos canônicos](../../05-contratos/README.md).

## Falhas, recuperação e segurança

Payload/versão/base inválidos são recusados antes de efeito pertinente; auth/cota não autorizam fallback pago. Writer unknown permanece bloqueado; não repetir execução ou liberar lease por idade. Credenciais não entram em DTO/contexto/log/artefato; API não executa código do projeto. Limites de cada contrato e gates de provider continuam necessários.

## Código e evidência

[packages/runtime/src/runtime-adapter.ts](../../../packages/runtime/src/runtime-adapter.ts) e [packages/runtime/src/codex-adapter.ts](../../../packages/runtime/src/codex-adapter.ts). Testes versionados ao lado dessas implementações e evidências por FAC-005/010C/012D/V/AA no [histórico](../../09-entregas/README.md). Não reexecutados aqui. [ADR-003 aceito](../../06-decisoes/ADR-003-stack-typescript.md) e [feature relacionada](../../04-features/provider-handoff.md).

## Limitações e direção posterior

[AS-IS versus alvo](../../02-arquitetura/as-is.md) separa controles atuais de tenancy/RLS/broker propostos. Presença de implementação/teste versionado não comprova instalação ou eficácia sob UID de serviço.

## Referência integral local

[Detalhes por incremento com nota editorial](referencia-v2.3.md). Evidências/contratos históricos permanecem completos; afirmações de estado vencidas são delimitadas pela auditoria.

## Direção posterior completa

[Engenharia do perfil futuro](direcao-proposta.md) preserva detalhes de auth/broker/ciclo/negações/compatibilidade do pacote. Proposta não prova eficácia atual.
