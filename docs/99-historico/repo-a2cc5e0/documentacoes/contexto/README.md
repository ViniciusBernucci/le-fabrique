# Contexto de execucao

Status: Context Builder e RuntimeGuard do FAC-006 aceitos na revisao `ea8cf7afb0e55840722f306262b5334bb408b51a`.

O `ContextBuilder` recebe workspace absoluto, revisao-base, fontes relativas explicitamente selecionadas e limites. Ele ordena os caminhos lexicalmente, le somente arquivos regulares dentro do workspace e devolve conteudo acompanhado de manifesto com caminho, papel, tamanho, SHA-256, total de bytes, omissoes e hash do proprio manifesto.

Caminhos absolutos, traversal, symlinks, dependencias, saidas geradas, nomes de segredo, binarios, conteudo com padroes fortes de segredo e arquivos fora dos limites sao omitidos com motivo normalizado. O builder nao percorre o repositorio automaticamente, nao usa embeddings e nao persiste o conteudo. Se houver qualquer omissao, `truncated` e verdadeiro; o chamador precisa decidir se ainda ha contexto suficiente.

O manifesto prova quais bytes foram selecionados para uma revisao-base. Ele nao prova que a selecao foi semanticamente suficiente e nao substitui acesso controlado as fontes originais.

O FAC-009 usa esse resultado no coordenador do worker e recusa prompts acima do limite do contrato do runtime. Objetivo, criterios, feedback de correcao e contexto entram em prompts separados por papel; o Reviewer recebe sessao e permissao `READ_ONLY` proprias. O conteudo continua sem persistencia automatica e os testes usam somente texto sintetico.
