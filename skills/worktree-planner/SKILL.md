---
name: worktree-planner
description: Planeja isolamento Git de tickets locais e ordem de integração na La fabrique. Use quando solicitado plano com worktrees; não cria backlog nem exige ferramentas externas ou paralelismo.
---

# Planejador de worktrees

Leia o [perfil da La fabrique](../00-perfil-la-fabrique.md) e as políticas ali indicadas antes de aplicar esta skill. 

Planeje a partir do ticket READY; confirme root, git worktree list, branches, baseline e alterações. Não impor duas worktrees backend/frontend: a própria fábrica é um monorepo, e um contrato compartilhado pode exigir sequência.

Usar base informada pelo usuário; developer é integração local observada, confirmar na tarefa. Identificar colisões apps/web, apps/api, apps/worker, packages/contracts/runtime e docs. Uma worktree por frente realmente independente; apenas um writer em cada uma. Não renomear branch existente ou descartar mudanças como etapa automática.

Plano, prompts e estado operativo vão nas evidências do ticket. [Plano local](references/plano-local.md) define conteúdo e verificação de limpeza. Cada prompt aponta às skills canônicas e políticas, com paths/hashes/omissões; descoberta em nova sessão não é presumida.

Gere comandos concretos somente para paths/branches confirmados. Criar/mergear/remover depende do escopo autorizado já existente; planejar não dá essa autorização. Sem esperar uma ferramenta de worktree inexistente. Limpeza só depois de conferir integração/backup e alterações locais; não usar force para apagar trabalho.

Saída: topologia, limites por frente, dependências, sequência de integração, comandos revisáveis, estado persistido e bloqueios concretos.
