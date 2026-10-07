> Leitura: [Índice didático](../../02-INDEX.md) · [Próximo →](01-referencia-v2.3.md)

# Painel de controle

IMPLEMENTADO no código base `a2cc5e0`; verificação operacional NÃO VERIFICADA nesta migração. Responsabilidade lógica, não nova classe/microserviço.

## Finalidade e limites

Oferecer navegação e operação administrativa da fábrica.

## Fluxo e comportamento

Menu principal: Painel, Projetos, Tarefas, Agentes de IA, Escritório, Usuários e Configurações, nessa ordem. Tarefas abre o painel demonstrativo FAC-033 sem exigir login; Projetos abre controle; Agentes de IA e Configurações abrem configurações; Escritório e Usuários usam a prévia de áreas futuras. Os atalhos da home são independentes do menu. [Entrega FAC-032](../../09-entregas/2026/2026-10-07-FAC-032-menu-inicial-reduzido.md).

Home estática antes de login → sessão Bearer → projetos/tickets/runs/operação; menu abre recolhido, mantém expansão durante navegação e reinicia recolhido no reload.

Exemplo didático: ticket com critério “validar um campo” só avança com a base/definição/checks aprovados; request inválido não vira comando autorizado. O exemplo não é execução desta migração.

## Estados, dados e regras

App/DashboardLayout; seta central no recolhido e padding direito 12px no expandido. Home simulada; admin protegido, sem token no bundle. Veja [estados por entidade](../../05-contratos/schemas/01-workflow.md) e [contratos canônicos](../../05-contratos/00-README.md).

## Falhas, recuperação e segurança

Payload/versão/base inválidos são recusados antes de efeito pertinente; auth/cota não autorizam fallback pago. Writer unknown permanece bloqueado; não repetir execução ou liberar lease por idade. Credenciais não entram em DTO/contexto/log/artefato; API não executa código do projeto. Limites de cada contrato e gates de provider continuam necessários.

## Código e evidência

[apps/web/src/App.tsx](../../../apps/web/src/App.tsx) e [apps/web/src/DashboardLayout.tsx](../../../apps/web/src/DashboardLayout.tsx). Testes versionados ao lado dessas implementações e evidências por FAC-020–031 no [histórico](../../09-entregas/00-README.md). Não reexecutados aqui. [ADR-003 aceito](../../06-decisoes/ADR-003-stack-typescript.md) e [feature relacionada](../../04-features/01-control-settings.md).

## Limitações e direção posterior

[AS-IS versus alvo](../../02-arquitetura/01-as-is.md) separa controles atuais de tenancy/RLS/broker propostos. Presença de implementação/teste versionado não comprova instalação ou eficácia sob UID de serviço.

## Referência integral local

[Detalhes por incremento com nota editorial](01-referencia-v2.3.md). Evidências/contratos históricos permanecem completos; afirmações de estado vencidas são delimitadas pela auditoria.

## Sequência de leitura deste capítulo

1. [referencia-v2.3](01-referencia-v2.3.md).
