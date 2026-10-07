# Le Fabrique — pacote multi-tenant v3 proposto

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.

Este pacote incorpora a direção multi-tenant à base v2.1 sem alterar os arquivos sincronizados em `sources/`. React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e uma VPS Linux são a base definida pelo usuário. A menção Laravel/Angular do PDF antigo fica substituída nesta proposta, sem afirmar que existe migração de código realizada.

## Começar

1. Leia [auditoria](documentacoes/AUDITORIA-FONTES.md), [índice](documentacoes/INDEX.md), [política](documentacoes/POLITICA-IA.md) e [arquitetura](documentacoes/arquitetura/ARQUITETURA.md).
2. Use o [prompt de preparação](prompts/PROMPT-00-PREPARACAO.md) no repositório real. Este espelho contém referências, não código da aplicação.
3. Implemente incrementalmente os [11 prompts](prompts/PROMPTS-IMPLEMENTACAO.md), conforme [backlog](BACKLOG.md) e [plano](PLANO-MVP.md).
4. Valide [testes negativos](documentacoes/seguranca/TESTES-ACEITE.md) na VPS de ensaio e na revisão exata antes de habilitar clientes.

O requisito é nenhum acesso não autorizado entre tenants, entre projetos ou ao plano de controle, mesmo se a IA obedecer a uma injeção. Provider Runtime é infraestrutura administrada confiável por tenant; modelo, comandos, conteúdo, plugins e resultados continuam não confiáveis. Segredos de provider nunca entram no sandbox. Provider cujo cliente oficial não permite essa separação comprovada permanece desabilitado.

Não há garantia matemática de isolamento absoluto em kernel/host compartilhados. A proposta bloqueia rotas e capacidades previstas e exige prova de acesso negado; escape do kernel, root comprometido e vulnerabilidades desconhecidas exigem mitigação e decisão de risco. Não liberar código arbitrário de terceiros no perfil de container comum apenas porque o piloto passou.

## Integração

Os arquivos de raiz e `documentacoes/` são revisões propostas para o repositório real; não copiar cegamente sobre regras locais. Preserve histórico, merge guias, corrija links conforme a árvore real e mantenha a auditoria de origem. O PDF original permanece referência v2.1 e não representa esta proposta. Nenhum PDF atualizado foi solicitado/gerado. Não há lessons de implementação inventadas.
