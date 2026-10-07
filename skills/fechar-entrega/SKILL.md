---
name: fechar-entrega
description: Fecha o registro documental e cria commit local da entrega da La fabrique quando autorizado. Use ao encerrar tarefa ou sessão; não aprova revisão/QA nem autoriza merge, deploy ou publicação.
---

# Fechar entrega

Leia o [perfil da La fabrique](../00-perfil-la-fabrique.md) e as políticas ali indicadas antes de aplicar esta skill. 

Consolidar somente alterações da tarefa. Confirmar branch/SHA/status, arquivos próprios e trabalho prévio. Usar [registro local](references/registro-local.md), template do Manual Vivo e evidências reais. Registro inclui objetivo/funcionamento/origem/revisão/checks/risco/rollback/limites/docs/aceite; não criar índice diário ou resumo externo herdado.

Com autorização de commit, revisar índice e adicionar paths explícitos. Não incluir staged de terceiros nem fazer unstage/reset silencioso. Usar mensagem compatível com o repo; não amend de revisão já referenciada. Se .git for read-only, produzir registro/patch/hashes e declarar sem commit, sem contornar a permissão. Não atribuir HEAD anterior ao novo trabalho.

Backlog/changelog/índice e capítulos atuais atualizados quando afetados; relatórios históricos preservados. Hash de código anterior ao registro evita circularidade; patch/manifesto têm exclusões explícitas. Commit não substitui revisão nem aceite.

Saída: mudanças/funcionamento, checks/resultados, limitações/rollback, caminhos e hash apenas se commit realmente realizado. Gate pendente permanece pendente. Merge/push/PR/deploy seguem autorização específica do usuário; não acontecem como efeito implícito do fechamento.
