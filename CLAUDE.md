# Guia do projeto — CLAUDE.md

Leia explicitamente e integralmente [POLITICA-IA](docs/00-governanca/POLITICA-IA.md) e [POLITICA-DOCUMENTACAO](docs/00-governanca/POLITICA-DOCUMENTACAO.md), depois [Manual Vivo](docs/README.md), README raiz, piloto, ticket e capítulos afetados. Links não incluem conteúdo automaticamente. Preserve regras locais mais específicas.

A stack está aprovada; não reabrir a decisão. Consulte [ADR-003 aceito](docs/06-decisoes/ADR-003-stack-typescript.md). Não executar outro writer sem prova de término no workspace. Instruções anteriores e especificidades estão preservadas no snapshot.

## Claude
Use cliente oficial sem modificar fluxo de autenticação. claude -p é o caminho não interativo; validar modo de cobrança/plano antes de ativá-lo. Não usar token OAuth do Claude Code como credencial de SDK ou chamada HTTP própria.
Este guia é carregado quando suportado pela versão/mode. --bare ignora CLAUDE.md e várias descobertas: se adotado, a fábrica precisa injetar política explicitamente, registrar hash e justificar a escolha. Não assumir regras carregadas.
Para review, usar sessão separada sem edição da revisão analisada e fornecer achados concretos com caminhos/critério. Preferência inicial por arquitetura/revisão é configurável e precisa de métricas. Não adicionar agentes paralelos automaticamente, pois consomem cota.


## Fallback de carregamento

Descoberta automática nesta versão: NÃO VERIFICADA por nova sessão. Se não houver leitura comprovada, abrir este guia e as duas políticas explicitamente no contexto do job; registrar paths/hashes e omissões. Não ampliar permissões, instalar provider ou ler credenciais para testar. Regras de fixtures continuam locais.
