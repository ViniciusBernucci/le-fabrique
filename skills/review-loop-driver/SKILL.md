---
name: review-loop-driver
description: Consolida achados e conduz correções autorizadas da La fabrique, preservando IDs e revisão. Use para fila/revalidação ou aplicação pedida; montar fila não autoriza editar nem aprova QA.
---

# Fila e correções de review

Leia o [perfil da La fabrique](../00-perfil-la-fabrique.md) e as políticas ali indicadas antes de aplicar esta skill. 

Leia relatórios e revisão exata do ticket. Consolidar somente causas equivalentes, preservando origem/ID. Grave fila e roteiro nas evidências do ticket; histórico append-only. Priorizar severidade/impacto/dependências. Suspeita sem caminho confirmado fica needs-validation, sem severidade inventada.

Relatório ou pedido de fila não autoriza corrigir. Pedido para aplicar IDs, filtro, fila inteira ou achados do relatório indicado autoriza o conjunto correspondente; uma autorização anterior continua válida na tarefa. Resolver referências pelo contexto sem pedir IDs de novo quando escopo já está claro. Não tocar item fora do lote autorizado; registrar follow-up.

Revalidar se código ainda corresponde; aplicar correção mínima e checks de regressão. Até duas rodadas, depois checkpoint/diagnóstico. Atualizar capítulo/entrega e fila conforme a política; a exceção importada de não documentar correções não se aplica.

Status de item: pendente, em andamento, aplicado/aguarda verificação, verificado, adiado ou nova tarefa. Commit apenas se autorizado, paths explícitos, sem trabalho alheio. Hash aplicado não prova gate independente; revisor revalida IDs e raio de impacto. O mesmo agente declara autorrevisão.

Saída: IDs aplicados/adiados, revisão/patch, checks, docs, riscos e gates pendentes. A fila não aprova QA nem libera merge/deploy por si só.
