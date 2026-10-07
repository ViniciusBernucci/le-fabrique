# AppSec do diff — fronteiras da fábrica

Rastrear entrada a operação privilegiada com autorização/validação upstream. API administrativa Bearer atual não é isolamento multi-tenant; ausência do alvo RLS/broker é gap proposto, não prova automática de exploração. Verificar o escopo/ameaça do ticket.

Paths/symlinks/checkout/archive/artifact, spawn/argumentos/shell, egress/SSRF, limites/timeout, logs/segredos, auth oficial segregada e code injection. Código de cliente não alcança controle/DB/Redis/auth/daemon. Detectar bypass de permissões e fallback API/extra, sem ler credenciais reais.

Queries Prisma/SQL raw e React dangerouslySetInnerHTML exigem caminho e controle do atacante, não só nome perigoso. Autorização de projeto/ticket/revisão e idempotência devem cobrir chamadores. Confirmar mitigação antes de classificar severidade; usar exemplos inertes. Nenhum teste destrutivo/produção.
