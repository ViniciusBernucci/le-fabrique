# ADR-002 — Controle e execução na mesma VPS

Data original: 2026-09-29. **Decisão de topologia ACEITA pelo usuário na fonte original; implementação PLANEJADA.** Edição recuperada do PDF, não nova aceitação.

## Contexto

A fonte relata que a v2 separava VPS de controle e worker no MacBook. O usuário optou por levar clientes oficiais, autenticação, builds e testes para a VPS.

## Decisão

Uma VPS Linux com separação lógica de controle/supervisor/runtime/código. Assinaturas e clientes oficiais; API e extras desligados. Perfil Bom de 8 vCPU/16 GB/200 GB era recomendação, contratação pendente.

## Alternativas e consequências

VPS + MacBook era a alternativa anterior. Centralização remove dependência do laptop, mas aumenta disputa por recursos e mantém ponto único de falha. Credenciais não podem ficar acessíveis a código. Merge/deploy seguem autorização aplicável.

## Verificação e revisão

Preflight/login/cobrança, teste de segredo inacessível, builds dentro do envelope, cancelamento/lease/reboot/restore precisam de ensaio. Nenhuma implantação comprovada. Rever separação de worker se risco/carga/disponibilidade justificarem, sem impor segundo servidor no MVP.

## Compatibilidade com a revisão atual

React/NestJS/Node-TS substituem stack antiga em outro registro (ADR-003); topologia é mantida. O desenho multi-tenant acrescenta gates, sem afirmar que ADR-002 já atende tenants hostis.

## Proveniência

- [Texto recuperado p.13](../99-historico/pdf-v2.1/recuperados/documentacoes/arquitetura/ADR-002-vps-unica.md)
