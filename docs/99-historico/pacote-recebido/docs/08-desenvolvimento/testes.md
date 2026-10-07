# Estratégia de testes

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Checks baratos antes da IA: lint/typecheck/testes/scans pertinentes à stack e ao risco. Separar falha de baseline de regressão. Rodar na revisão final, invalidando evidências após mudança pertinente.

Essenciais herdados: claim/eventos idempotentes; perda de worker interrompe writer; processo antigo não continua após handoff; untracked recuperável; auth/cota sem loop; API key herdada bloqueada; extras desligados verificados; secrets inacessíveis; doc gate rejeita incompletude; aceite invalidado por novo diff.

Adapters começam com fixtures/fakes sanitizados; teste real opt-in após gates, sem gastar quota de propósito para simular falha. Integrações Postgres/Redis e suite Linux comprovam mecanismos que mock não prova. Catálogo negativo completo está em [testes de segurança](testes-seguranca.md). NOT_RUN/UNSUPPORTED nunca vira PASS.

Cada resultado registra critério/command/procedimento, revisão/config/versões, resultado observado, horário, evidência sanitizada e limitações. Neste trabalho foram feitos checks documentais, não de software.
