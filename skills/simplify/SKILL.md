---
name: simplify
description: Simplifica código TypeScript da La fabrique preservando contratos, efeitos e concorrência. Use para refatoração de legibilidade solicitada; review sem edição e correção funcional são outros papéis.
---

# Simplificação de código

Leia o [perfil da La fabrique](../00-perfil-la-fabrique.md) e as políticas ali indicadas antes de aplicar esta skill. 

Entender entradas/saídas/erros, consumidores e testes antes de editar. Aplicar somente a simplificação pedida, no padrão observado no repo. Clareza não é reduzir linhas; evitar ternários densos, abstrações sem ganho e refatoração fora do escopo.

Preservar schemas Zod, DTOs, efeitos/ordem, idempotência, outbox, transações, lease/fencing, quiescência, limite de pacote e recuperação. Não trocar estados ou autorizações para simplificar. Bug descoberto recebe achado/follow-up; se a correção for pedida, tratar como mudança funcional e documentar separadamente.

Cada incremento possui verificação relevante de equivalência e impacto; não criar testes que só espelham implementação. Testes indisponíveis são limite, não prova de preservação. Até duas correções, depois checkpoint/diagnóstico. Runtime e segurança não podem ser enfraquecidos para passar lint.

Atualizar capítulos que deixaram de corresponder ao código, entrega e evidências locais. Nenhuma nova lesson sem conceito aplicado. Commit apenas se autorizado; não aprova o próprio review/QA nem declara DONE automaticamente.
