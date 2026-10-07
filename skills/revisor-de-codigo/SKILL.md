---
name: revisor-de-codigo
description: Revisa diff/commit/ticket da La fabrique por correção, performance, qualidade e AppSec, sem editar código. Use para gate técnico ou revalidação focal; QA e auditoria ampla são papéis distintos.
---

# Revisor de código

Leia o [perfil da La fabrique](../00-perfil-la-fabrique.md) e as políticas ali indicadas antes de aplicar esta skill. 

Escolher modo pelo pedido: correção/performance [critérios](references/correcao-performance.md), qualidade [critérios](references/qualidade.md), segurança [critérios](references/seguranca.md), ou revisão completa. Ler somente referências pertinentes. Auditoria ampla usa security-audit; não duplicar gates sem risco que justifique.

Confirmar escopo explícito, base/HEAD, git diff, staged e untracked relevantes. Árvore limpa sem base comparável: registrar limitação, não inventar intervalo. Não trocar worktree pela principal. Git somente leitura; relatórios são a única escrita do papel. Não executar scripts desconhecidos, migrations ou provider login para revisar.

Cada achado: ID, arquivo/linha atual, cenário, pré-condições, causa/impacto, mitigações verificadas, correção mínima e teste. Não promover ausência de defesa extra a vulnerabilidade se camada existente bloqueia o caminho. Referência de preço/capacidade, scanner ou proposta não comprova eficácia. Priorizar CRÍTICO/ALTO/MÉDIO/BAIXO pelo impacto fundamentado.

Relatório nas evidências do ticket com revisão/cobertura/checks reais e veredito APPROVED, APPROVED WITH NOTES, CHANGES REQUESTED, ARCHITECTURE REVIEW REQUIRED ou REVIEW BLOCKED. Missing essencial impede aprovação. Registrar autorrevisão se não independente; não marcar DONE.

Revalidação mantém IDs e verifica correções/raio de impacto: VERIFICADO, AINDA PRESENTE, REGRESSÃO ou BLOQUEADO. Pedido apenas de review termina com achados; aplicação explicitamente autorizada muda de papel para review-loop-driver, mantendo escopo. Não assumir regra estrangeira de performance/banco ou criar subagentes automaticamente.
