# Economia, quotas e custos

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Assinatura/capacidade é o modelo principal. monthly_api_budget=0; fallback API, extra usage, créditos/autorecharge desligados como política; o preflight precisa verificar a conta real. Não contratar planos/VPS por este documento.

Custo mensal = VPS + backup + assinaturas + extras autorizados + storage externo + manutenção. Custo incremental = novas despesas causadas pela fábrica. Custo por aceito = custo atribuído ao experimento / tickets aceitos, incluindo falhas no numerador. Sem aceitos, resultado indefinido. Método de alocação dos custos fixos deve ser explícito. Tokens/preço teórico do CLI não somam como cobrança real sobre assinatura.

Preservar práticas úteis: tickets pequenos, baseline, contexto por rg/imports/checks, Developer/Reviewer no fluxo comum, revisão independente, limites de correção/timeout/handoff/concorrência, modelos expostos e elegíveis, caches por revisão/ownership, checkpoint objetivo e medir dez tickets. Não carregar conversas inteiras. Contexto 20–40 mil tokens é teto inicial histórico a adaptar, não necessidade mínima.

Cache cliente não implica desconto de assinatura; Batch/cache monetário e BudgetGuard API são extensões futuras. Não somar descontos ou prometer capacidade ilimitada/tickets por plano. Quando todos indisponíveis, esperar. Custos fixos continuam existindo; não prometer gasto total zero. Energia doméstica não é custo de worker nesta topologia VPS.

Preços/planos/capacidade atual não foram revalidados financeiramente neste trabalho. Preencher com cobrança real, moeda decimal, data e fonte no ambiente autorizado.

## Proveniência

- [Economia original p.26](../99-historico/pdf-v2.1/recuperados/documentacoes/economia/README.md)
- [Custos/roteamento pp.6–8](../99-historico/pdf-v2.1/recuperados/documentacoes/arquitetura/ARQUITETURA.md)
