# Carregamento das instruções dos agentes

## Codex — orientação histórica do pacote

AGENTS.md de raiz é ponto de entrada. A descoberta considera overrides e hierarquia até o diretório de trabalho; há limite combinado de conteúdo. Um link para política não é inclusão automática: o wrapper exige leitura explícita. Reiniciar sessão e confirmar fontes carregadas após integração.

O pacote registra consulta em 2026-10-06 (não reexecutada nesta migração): [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md). A documentação pública descreve descoberta; a eficácia na versão local deve ser testada. Nenhuma configuração global foi alterada.

## Claude e Antigravity

As referências históricas de setembro estão no [catálogo de fontes](fontes-tecnicas.md). Este trabalho não revalida todo modo/plano/CLI nem promete carregamento nativo. CLAUDE.md deve ser verificado no modo instalado; ANTIGRAVITY.md é guia explícito e .agents/rules/documentacao.md é ponte a verificar, não regra supostamente universal. Injeção explícita de conteúdo é fallback editorial, sem conceder mais permissões.

## Teste de adoção no repo real

Abrir nova sessão no root e pedir: “Liste os arquivos de instrução ativos, leia as duas políticas e diga o destino de uma entrega, de um contrato e de uma lesson.” Conferir com arquivos/logs de carregamento quando disponíveis, sem ler auth. Resultado esperado: docs/09-entregas, docs/05-contratos e docs/10-lessons condicional; nenhuma nova política duplicada. Autorrelato do agente é indício de leitura, não gate técnico da fábrica.

## Observação local 2026-10-07

Somente --version executado: codex-cli 0.159.2; Claude Code 2.1.285; agy 1.2.17. Instruções hierárquicas de raiz/.agents e fixtures inventariadas; sem AGENTS ancestral localizado em /home/vinicius, /home ou /. Nenhuma nova sessão de inferência/cliente executada: disponibilidade de binário não comprova provider elegível, cobrança de assinatura/extra desligado ou leitura das políticas. O escopo documental não altera autenticação/permissões para testar autoload. Resultado NÃO VERIFICADO por agente.

Fallback obrigatório: abrir explicitamente AGENTS/CLAUDE/ANTIGRAVITY e docs/00-governanca/POLITICA-IA.md + POLITICA-DOCUMENTACAO.md no job; registrar SHA-256/config e omissões antes de editar. A versão instalada pode carregar hierarquia/override específicos; confirmar numa sessão autorizada, sem ampliar permissões nem ler auth.
