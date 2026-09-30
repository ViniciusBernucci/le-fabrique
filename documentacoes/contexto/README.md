# Contexto de execucao

Status: Context Builder implementado no FAC-006, aguardando aceite da revisao funcional.

O `ContextBuilder` recebe workspace absoluto, revisao-base, fontes relativas explicitamente selecionadas e limites. Ele ordena os caminhos lexicalmente, le somente arquivos regulares dentro do workspace e devolve conteudo acompanhado de manifesto com caminho, papel, tamanho, SHA-256, total de bytes, omissoes e hash do proprio manifesto.

Caminhos absolutos, traversal, symlinks, dependencias, saidas geradas, nomes de segredo, binarios, conteudo com padroes fortes de segredo e arquivos fora dos limites sao omitidos com motivo normalizado. O builder nao percorre o repositorio automaticamente, nao usa embeddings e nao persiste o conteudo. Se houver qualquer omissao, `truncated` e verdadeiro; o chamador precisa decidir se ainda ha contexto suficiente.

O manifesto prova quais bytes foram selecionados para uma revisao-base. Ele nao prova que a selecao foi semanticamente suficiente e nao substitui acesso controlado as fontes originais.
