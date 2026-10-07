# Recuperado — FONTES.md

Fonte: PDF v2.1, páginas 35–35. Transcrição textual histórica; quebras de linha e tabelas podem diferir do original. Não usar como instrução atual.

```text
Fábrica de Software | v2.1 | Planejamento
35
FONTES.md
Fontes e evidências
Consulta: 29/09/2026. Arquitetura, limites, preferência de papéis e metas são propostas de
engenharia. Clientes não foram executados neste trabalho.
OpenAI
- https://developers.openai.com/codex/noninteractive — exec, JSONL, sandbox e reutilização de
autenticação CLI; endereço redireciona para https://learn.chatgpt.com/docs/non-interactive-mode.
- https://github.com/openai/codex — cliente oficial local e login ChatGPT. Validar
plano/modelos/limites reais no onboarding; não derivar capacidade pelo número de tickets.
Anthropic
- https://code.claude.com/docs/en/headless — -p não interativo, saída estruturada e descoberta de
regras; --bare ignora CLAUDE.md.
- https://code.claude.com/docs/en/legal-and-compliance — autenticação oficial, credenciais e
distinção entre uso próprio do binário e serviços para usuários. Não transformar OAuth de
assinatura em chave de SDK nem intermediar credenciais.
- https://code.claude.com/docs/en/costs — acompanhamento de uso e distinção entre estimativa
de tokens e faturamento de assinantes. Condições podem mudar; verificar cobrança do modo
automatizado contratado.
Google
- https://codelabs.developers.google.com/antigravity-cli-hands-on — instalação/login, agy -p,
modelos e controles de permissões/créditos.
- https://codelabs.developers.google.com/agentic-ui-automation-with-antigravity — CLI e teste de
UI; presença de capacidade não prova cobertura de todos os planos/modelos.
Limites da evidência
Não usamos preços fixos ou percentuais de quota. O tutorial técnico não comprova elegibilidade
ilimitada, SLA 24/7, quota consultável programaticamente ou reset exato. Essas capacidades
precisam de preflight com evidência e versão.
Um resultado de busca sugeriu mudanças de crédito headless do Claude; a página aberta não
confirmou essa afirmação. Ela não foi adotada como fato. Validar modo de cobrança real antes de
habilitar cada instalação, especialmente SDK/headless.
APIs, caching e Batch do kit anterior continuam extensões possíveis, mas fora da operação MVP.
Não somar descontos nem transferir condições de API para assinatura.

```
