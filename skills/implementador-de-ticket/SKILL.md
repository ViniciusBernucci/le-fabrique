---
name: implementador-de-ticket
description: Implementa um ticket READY da La fabrique dentro dos contratos e da stack aprovada, com checks e Manual Vivo. Use para tarefa especificada; não expande backlog nem redesenha a arquitetura.
---

# Implementador de ticket

Leia o [perfil da La fabrique](../00-perfil-la-fabrique.md) e as políticas ali indicadas antes de aplicar esta skill. 

Confirmar ticket/objetivo/paths/critérios, baseline, provider elegível e limites. Inspecionar código relacionado antes de editar. Aplicar menor incremento que atenda ao comportamento pedido; preservar contrato Zod em runtime e segredos fora do painel. Não executar builds/clientes pela API; worker e runtime fazem execução isolada.

Não aproveitar o ticket para migrar stack, habilitar provider, adicionar tenancy ou corrigir backlog inteiro. Divergência estrutural recebe pendência/proposta para arquiteto. Dados/migrations exigem compatibilidade, locks, rollback e operação autorizada; escrever migration não autoriza aplicá-la em produção.

Checks seguem risco e scripts reais; até duas rodadas de correção, depois checkpoint/diagnóstico. Não mudar testes para esconder regressão. Atualizar capítulos atuais afetados e entrega/evidências/índices, mantendo ordem didática. Lessons condicionais à aplicação real.

Correção funcional ou de review explicitamente pedida já constitui autorização dentro do escopo; relatório sem pedido de aplicação não autoriza corrigir. Não exigir indicação repetida de IDs quando a sessão já autorizou o lote.

Entregar funcionamento, diff sanitizado, comandos/resultados, critérios ATENDIDO/NÃO ATENDIDO/NÃO VALIDADO, riscos/rollback e documentação. Implementação própria não é revisão/QA independente. Commit pelo fechamento autorizado; DONE só após aceite exato.
