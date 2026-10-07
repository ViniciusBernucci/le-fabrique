# Guia do projeto — ANTIGRAVITY.md

Leia explicitamente e integralmente [POLITICA-IA](docs/00-governanca/01-POLITICA-IA.md) e [POLITICA-DOCUMENTACAO](docs/00-governanca/02-POLITICA-DOCUMENTACAO.md), depois [Manual Vivo](docs/01-README.md), README raiz, [piloto](docs/08-desenvolvimento/07-piloto.md), ticket e capítulos afetados. Links não incluem conteúdo automaticamente. Preserve regras locais mais específicas.

A stack está aprovada; não reabrir a decisão. Consulte [ADR-003 aceito](docs/06-decisoes/ADR-003-stack-typescript.md). Não executar outro writer sem prova de término no workspace. Instruções anteriores e especificidades estão preservadas no snapshot.

## Carregamento e uso
ANTIGRAVITY.md é guia do projeto; não presumir que seja nome reservado. A regra comum em .agents/rules/documentacao.md também precisa de teste de carregamento na versão/superfície instalada. Se ignorada, incluir guia e política explicitamente no prompt do job.
Google documenta agy -p para automação. Confirmar versão, modelos, autenticação, saída, permissões e créditos no preflight; browser/E2E só quando capacidade comprovada. Não assumir que todo modelo listado é coberto pelo plano.
UI/QA deve testar critérios com dados sintéticos e anexar evidências da revisão exata. Capturas não provam todas as regras de negócio; checks determinísticos continuam necessários. Navegador sem sessões pessoais, contas de produção ou credenciais reais. Modo always-proceed não substitui isolamento nem é padrão do MVP.


## Fallback de carregamento

Descoberta automática nesta versão: NÃO VERIFICADA por nova sessão. Se não houver leitura comprovada, abrir este guia e as duas políticas explicitamente no contexto do job; registrar paths/hashes e omissões. Não ampliar permissões, instalar provider ou ler credenciais para testar. Regras de fixtures continuam locais.

## Onde registrar e consultar documentação

- Trabalho e aceites: [backlog canônico](docs/08-desenvolvimento/09-backlog.md); planejamento: [plano MVP](docs/08-desenvolvimento/10-plano-mvp.md).
- Mudanças resumidas: [changelog](docs/04-CHANGELOG.md). Relatos completos: `docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md`.
- Atualizar módulos/features/contratos/runbooks afetados; lessons somente quando aplicadas. Usar [templates](docs/00-governanca/templates/00-README.md).
- Começar pelo [prompt inicial](prompts/PROMPT-INICIAL.md) e [guia de integração](docs/00-governanca/03-GUIA-DE-INTEGRACAO.md). Consultar o [índice](docs/02-INDEX.md).

Não recriar BACKLOG, CHANGELOG, PILOTO, PLANO-MVP, CONTROLE-MVP, ESPEC-MVP, FONTES, MATRIZ-COBERTURA, PROMPT-INICIAL ou GUIA-DE-INTEGRACAO na raiz. README e guias de agentes são entradas; os capítulos têm fonte única nas pastas indicadas. Abrir as políticas explicitamente; autoload continua NÃO VERIFICADO.

A pasta legada `documentacoes/` foi removida após conferência de conteúdo e hashes. Documentação nova e atual segue `docs/`; evidências históricas estão em `docs/09-entregas/<ano>/evidencias/`. Não recriar a pasta antiga.

## Ordem de leitura obrigatória

Organizar capítulos em ordem didática, pelo conhecimento necessário ao leitor, com nomes `NN-titulo.md`, introdução local `00-README.md` e navegação anterior/próximo. Começar pelo [roteiro](docs/00-LEIA-ME-PRIMEIRO.md). Seguir a [regra de ordenação](docs/00-governanca/02-POLITICA-DOCUMENTACAO.md#ordem-didática-obrigatória-dos-arquivos) e atualizar mapa de ordem, índices e links a cada novo capítulo. Não usar cronologia de implementação como roteiro. IDs de ADRs/tickets e datas de entregas permanecem; snapshots/evidências são íntegros. Pontes antigas de política devem levar à fonte numerada, lida integralmente.

## Skills específicas da La fabrique

Antes de aplicar uma skill, abrir [perfil local](skills/00-perfil-la-fabrique.md) e `skills/<nome>/SKILL.md`. Essas versões adaptadas são a fonte corrente para este repositório. As cópias importadas em `.agents/skills` permanecem somente leitura no ambiente e contêm contexto de outro projeto; não executar suas convenções de tarefa/publicação externa, stack ou caminhos. Se o catálogo da sessão oferecer uma cópia importada, ler a versão adaptada antes de aplicar o papel.

Usar backlog/tickets Git locais, os paths numerados do Manual Vivo e gates da política comum. Nenhuma skill autoriza subagentes, gastos, merge/push/deploy ou acesso a credenciais por si só. Descoberta automática de `skills/` NÃO VERIFICADA; fallback é leitura explícita, sem alterar configurações globais nem presumir instalação em `.agents`.
