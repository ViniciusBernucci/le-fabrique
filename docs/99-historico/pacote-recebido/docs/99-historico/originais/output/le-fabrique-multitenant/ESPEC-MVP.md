# Contratos implementáveis v3 propostos

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.

Esta revisão complementa as entidades e estados v2.1 com tenant/project scope obrigatório. [Identidade e RLS](documentacoes/tenant-isolation/README.md), [runtime](documentacoes/runtime/README.md), [tools](documentacoes/seguranca/CAPABILITIES-E-TOOLS.md) e [operação](documentacoes/operacao/README.md) definem a semântica normativa. Contratos são internos da fábrica; nenhum JSON abaixo é configuração nativa de fornecedor.

## JobPackage ilustrativo sem segredos

```json
{
  "schema_version": "3-proposta",
  "tenant_id": "fixture-A",
  "project_id": "fixture-A1",
  "run_id": "fixture-run",
  "attempt_id": "fixture-attempt",
  "provider_installation_id": "fixture-install-A",
  "revision": "REVISÃO_REAL_OBRIGATÓRIA_NA_EXECUÇÃO",
  "policy_version": "fixture-policy",
  "context_manifest_id": "fixture-manifest",
  "tool_profile": "project-developer",
  "network_profile": "deny-all",
  "deadline": "DEFINIDO_PELO_SERVIDOR",
  "fencing_token": 1
}
```

IDs são fixtures ilustrativas, não registros reais. Envelope autenticado inclui hash do manifesto e expiração concretos no código futuro. `credential_ref` fica só na resolução interna e não integra pacote da IA. Paths de host, secrets, DSN, tokens de controle e endpoints administrativos são proibidos. Hashes do contexto/base e versão da política garantem associação; contexto vindo de projeto não redefine esse envelope.

## APIs

Preservar projects/tickets/runs/events/pause/cancel/resume/approvals e catálogo de providers com authZ tenant/projeto server-side. POST /runs usa Idempotency-Key escopada por tenant/principal/operação. PATCH de provider aceita política/metadados autorizados, nunca senha/token OAuth/gasto ativado por evento. Consulta de saúde filtra instalação do tenant. Onboarding login é procedimento administrativo oficial, não formulário coletor de tokens.

401 sem identidade, 403/404 genérico para recurso não autorizado conforme convenção única do repo, 409 estado/revisão/fencing obsoleto, 422 contrato inválido. Não distinguir outro tenant de inexistente. Worker protocol é superfície interna separada com claims transacionais/outbox, eventos deduplicados e fencing; não é tool da IA.

## Persistência e validade

Tenant obrigatório em toda entidade privada, FK composta e índices por escopo. Artifacts imutáveis e hash/tamanho/tipo/retention; aprovações vinculadas ao code SHA + policy/config relevantes. Event_id e sequence únicos por attempt; lock writer e optimistic version. Ledger decimal/unknown, sem float para dinheiro. Uso de assinatura não é cobrança API. Checkpoint contém stopped_confirmed e prova externa, não declaração do modelo.

## Implementado versus planejado

Nenhuma interface, migration, controller, adapter, RLS ou infra foi implementada neste pacote. Quando código existir, publicar tabela por contrato com caminho/revisão/teste/evidência; não promover todo documento para IMPLEMENTADO por concluir um módulo.
