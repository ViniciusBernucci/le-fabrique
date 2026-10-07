# Entidades e invariantes

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Esta é a base v2 reconciliada com tenancy: todos os registros privados ganham tenant_id e relações compostas; ProjectGrant restringe projeto; ProviderInstallation e CredentialMetadata seguem tenant/provider. A estrutura exata de tabelas/DTOs ainda não existe neste espelho.

Project: repo/ref, policies, caminhos e checks cadastrados. Ticket: objetivo/aceite, risco, runtime_limits, budget opcional, status. Run: revisão/base, branch, estado, policy_version e version para lock otimista. Step/Attempt: papel, tentativa, provider, lease_owner/expires, fencing_token, processo/session IDs quando observáveis.
Worker: ID, capacidades verificadas, OS/arch/versão, last heartbeat, disponibilidade e resource limits. ProviderInstallation: worker/provider, cli_version, auth_method, billing_mode, models_verified, capabilities, status e evidência de preflight; sem tokens pessoais.
UsageObservation: instalação, janela/modelo/unidade, valor nullable, reset nullable, fonte e observed_at. AgentExecution: attempt, input/context hashes, result status, modelo efetivo nullable, usage nullable, limites e timestamps. Checkpoint: code SHA, patch/untracked artifacts, stopped_confirmed, next actions e schema_version.
ContextManifest: revisão, fontes/hashes, tamanho estimado, omissões/truncamentos e instruction hashes. Artifact: caminho validado/hash/tamanho/tipo/retention. Approval: actor, run e revisão exata. LedgerEntry: fixed_subscription/extra/api, moeda, valor decimal nullable, alocação/estimativa/reconciliação e fonte.
Constraints: event_id e sequence únicos por attempt; um writer por workspace; transições versionadas; aprovação vinculada ao code SHA; dispatch via outbox; artefatos imutáveis por hash. Nunca dinheiro em float.

A extensão detalhada de ownership, FK, RLS, conexão pooled e storage pertence ao [módulo tenant isolation](../../03-modulos/tenant-isolation/README.md). Não criar SQL executável sem versão real do PostgreSQL e modelo aprovado.

## Proveniência

- [Base original](../../99-historico/originais/sources/ESPEC-MVP.md)
- [Extensão v3](../../03-modulos/tenant-isolation/README.md)
