# Superfícies de segurança da La fabrique

1. API/controle: autenticação administrativa, autorização por objeto/projeto, schemas Zod, erros e limite de corpo.
2. Contexto/artefatos: escopo de paths/revisão, hashes, omissões, symlink/path traversal, extração/upload e dados sensíveis.
3. Runtime/sandbox: cliente oficial/auth fora do código, permissões de tools comprovadas, spawn/args/cancelamento, egress e ausência de daemon/controle/DB na sandbox.
4. Lifecycle: índice writer global, stopped_confirmed, lease/fence/heartbeat, resultado desconhecido, retry/idempotência/outbox e checkpoint recuperável.
5. Disponibilidade/finanças: limite por processo/job, concorrência, fila/cache, timeout e subscription-only sem extras/API/fallback.
6. Dados/operação: transações, backup criptografado/chave externa, restore staging, retention/RPO/RTO comprovados ou hipótese, logs com redação.
7. Supply chain: manifests/lockfile, scripts/hooks, Compose/VPS, volume/mount, usuário/ownership e CI apenas quando existente.
8. Fronteiras futuras: tenancy/RLS/broker continuam propostas; separar AS-IS, requisito aprovado e eficácia verificada. Não afirmar segregação hostil sem ensaio.

Cada superfície exige caminho/revisão, achado confirmado ou needs-validation, verificação/limites e risco residual. Corrigir exige escopo autorizado; não exportar credenciais nem produzir payload vivo.
