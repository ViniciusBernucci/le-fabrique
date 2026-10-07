# Carregamento das instruções dos agentes

## Codex — orientação consultada nesta tarefa

AGENTS.md de raiz é ponto de entrada. A descoberta considera overrides e hierarquia até o diretório de trabalho; há limite combinado de conteúdo. Um link para política não é inclusão automática: o wrapper exige leitura explícita. Reiniciar sessão e confirmar fontes carregadas após integração.

Fonte oficial consultada em 2026-10-06: [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md). A documentação pública descreve descoberta; a eficácia na versão local deve ser testada. Nenhuma configuração global foi alterada.

## Claude e Antigravity

As referências históricas de setembro estão no [catálogo de fontes](fontes-tecnicas.md). Este trabalho não revalida todo modo/plano/CLI nem promete carregamento nativo. CLAUDE.md deve ser verificado no modo instalado; ANTIGRAVITY.md é guia explícito e .agents/rules/documentacao.md é ponte a verificar, não regra supostamente universal. Injeção explícita de conteúdo é fallback editorial, sem conceder mais permissões.

## Teste de adoção no repo real

Abrir nova sessão no root e pedir: “Liste os arquivos de instrução ativos, leia as duas políticas e diga o destino de uma entrega, de um contrato e de uma lesson.” Conferir com arquivos/logs de carregamento quando disponíveis, sem ler auth. Resultado esperado: docs/09-entregas, docs/05-contratos e docs/10-lessons condicional; nenhuma nova política duplicada. Autorrelato do agente é indício de leitura, não gate técnico da fábrica.
