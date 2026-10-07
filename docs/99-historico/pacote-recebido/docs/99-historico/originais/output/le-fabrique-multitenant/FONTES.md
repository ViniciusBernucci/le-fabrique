# Fontes e evidências
Consulta: 29/09/2026. Arquitetura, limites, preferência de papéis e metas são propostas de engenharia. Clientes não foram executados neste trabalho.
## OpenAI
- https://developers.openai.com/codex/noninteractive — exec, JSONL, sandbox e reutilização de autenticação CLI; endereço redireciona para https://learn.chatgpt.com/docs/non-interactive-mode.
- https://github.com/openai/codex — cliente oficial local e login ChatGPT. Validar plano/modelos/limites reais no onboarding; não derivar capacidade pelo número de tickets.
## Anthropic
- https://code.claude.com/docs/en/headless — -p não interativo, saída estruturada e descoberta de regras; --bare ignora CLAUDE.md.
- https://code.claude.com/docs/en/legal-and-compliance — autenticação oficial, credenciais e distinção entre uso próprio do binário e serviços para usuários. Não transformar OAuth de assinatura em chave de SDK nem intermediar credenciais.
- https://code.claude.com/docs/en/costs — acompanhamento de uso e distinção entre estimativa de tokens e faturamento de assinantes. Condições podem mudar; verificar cobrança do modo automatizado contratado.
## Google
- https://codelabs.developers.google.com/antigravity-cli-hands-on — instalação/login, agy -p, modelos e controles de permissões/créditos.
- https://codelabs.developers.google.com/agentic-ui-automation-with-antigravity — CLI e teste de UI; presença de capacidade não prova cobertura de todos os planos/modelos.
## Limites da evidência
Não usamos preços fixos ou percentuais de quota. O tutorial técnico não comprova elegibilidade ilimitada, SLA 24/7, quota consultável programaticamente ou reset exato. Essas capacidades precisam de preflight com evidência e versão.
Um resultado de busca sugeriu mudanças de crédito headless do Claude; a página aberta não confirmou essa afirmação. Ela não foi adotada como fato. Validar modo de cobrança real antes de habilitar cada instalação, especialmente SDK/headless.
APIs, caching e Batch do kit anterior continuam extensões possíveis, mas fora da operação MVP. Não somar descontos nem transferir condições de API para assinatura.


## Extensão v3 proposta — 2026-10-06

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.
## Fontes técnicas consultadas nesta revisão

- [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html): RLS e exceções de privilégio. Versão real do banco ainda precisa ser identificada.
- [Docker — Engine security](https://docs.docker.com/engine/security/): daemon, privilégios e superfície de isolamento.
- [gVisor — arquitetura de segurança](https://gvisor.dev/docs/architecture_guide/intro/): alternativa de isolamento a avaliar, sem benchmark local.
- [OWASP — SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): controles de destinos, redirecionamento e DNS.

Essas fontes sustentam os princípios técnicos; não comprovam configuração da VPS ou compatibilidade Codex/Claude/Antigravity com ferramentas remotas. As referências de clientes de 29/09/2026 permanecem históricas; flags/planos/termos atuais não foram revalidados neste pacote, são gate de preflight por instalação. Não extrapolar tutorial de CLI para suporte comercial multi-tenant nem para mediação completa de ferramentas.
