# Escopo e evolução

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

| Dimensão | Direção documentada | Limite |
|---|---|---|
| Stack da fábrica | React + NestJS + worker Node/TypeScript; PostgreSQL/Redis | Versões/toolchain do repo real pendentes |
| Topologia | VPS Linux única, inferência externa, um executor | Não implica HA nem contratação |
| Autenticação IA | Clientes oficiais, assinaturas primeiro | Preflight e elegibilidade por instalação |
| Tenancy | Cadeia tenant/projeto/run/attempt/instalação planejada | Piloto próprio/sintético; terceiros hostis bloqueados até gates |
| Entrega | código/checks/review/docs/aceite por revisão | Sem merge/deploy automáticos |
| Evolução | terceiro adapter/browser, mais workers, Temporal, API, perfil forte | Decisão posterior, sem ativação automática |

Uso pessoal exclusivo e Laravel/Angular eram limites históricos do PDF. A proposta v3 amplia desenho técnico para multi-tenant; isso não prova suporte dos fornecedores ao modelo comercial. O software piloto mantém sua própria stack. R0/R1 no primeiro experimento; R3/R4 excluídos.

## Proveniência

- [Direção v3](../99-historico/originais/output/le-fabrique-multitenant/README.md)
- [Arquitetura histórica](../99-historico/pdf-v2.1/recuperados/documentacoes/arquitetura/ARQUITETURA.md)
