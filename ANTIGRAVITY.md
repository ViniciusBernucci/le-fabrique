# Guia do projeto — ANTIGRAVITY.md

Leia explicitamente e integralmente [POLITICA-IA](docs/00-governanca/POLITICA-IA.md) e [POLITICA-DOCUMENTACAO](docs/00-governanca/POLITICA-DOCUMENTACAO.md), depois [Manual Vivo](docs/README.md), README raiz, [piloto](docs/08-desenvolvimento/piloto.md), ticket e capítulos afetados. Links não incluem conteúdo automaticamente. Preserve regras locais mais específicas.

A stack está aprovada; não reabrir a decisão. Consulte [ADR-003 aceito](docs/06-decisoes/ADR-003-stack-typescript.md). Não executar outro writer sem prova de término no workspace. Instruções anteriores e especificidades estão preservadas no snapshot.

## Carregamento e uso
ANTIGRAVITY.md é guia do projeto; não presumir que seja nome reservado. A regra comum em .agents/rules/documentacao.md também precisa de teste de carregamento na versão/superfície instalada. Se ignorada, incluir guia e política explicitamente no prompt do job.
Google documenta agy -p para automação. Confirmar versão, modelos, autenticação, saída, permissões e créditos no preflight; browser/E2E só quando capacidade comprovada. Não assumir que todo modelo listado é coberto pelo plano.
UI/QA deve testar critérios com dados sintéticos e anexar evidências da revisão exata. Capturas não provam todas as regras de negócio; checks determinísticos continuam necessários. Navegador sem sessões pessoais, contas de produção ou credenciais reais. Modo always-proceed não substitui isolamento nem é padrão do MVP.


## Fallback de carregamento

Descoberta automática nesta versão: NÃO VERIFICADA por nova sessão. Se não houver leitura comprovada, abrir este guia e as duas políticas explicitamente no contexto do job; registrar paths/hashes e omissões. Não ampliar permissões, instalar provider ou ler credenciais para testar. Regras de fixtures continuam locais.

## Onde registrar e consultar documentação

- Trabalho e aceites: [backlog canônico](docs/08-desenvolvimento/backlog.md); planejamento: [plano MVP](docs/08-desenvolvimento/plano-mvp.md).
- Mudanças resumidas: [changelog](docs/CHANGELOG.md). Relatos completos: `docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md`.
- Atualizar módulos/features/contratos/runbooks afetados; lessons somente quando aplicadas. Usar [templates](docs/00-governanca/templates/README.md).
- Começar pelo [prompt inicial](prompts/PROMPT-INICIAL.md) e [guia de integração](docs/00-governanca/GUIA-DE-INTEGRACAO.md). Consultar o [índice](docs/INDEX.md).

Não recriar BACKLOG, CHANGELOG, PILOTO, PLANO-MVP, CONTROLE-MVP, ESPEC-MVP, FONTES, MATRIZ-COBERTURA, PROMPT-INICIAL ou GUIA-DE-INTEGRACAO na raiz. README e guias de agentes são entradas; os capítulos têm fonte única nas pastas indicadas. Abrir as políticas explicitamente; autoload continua NÃO VERIFICADO.

A pasta legada `documentacoes/` foi removida após conferência de conteúdo e hashes. Documentação nova e atual segue `docs/`; evidências históricas estão em `docs/09-entregas/<ano>/evidencias/`. Não recriar a pasta antiga.
