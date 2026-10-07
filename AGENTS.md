# Guia do projeto — AGENTS.md

Leia explicitamente e integralmente [POLITICA-IA](docs/00-governanca/POLITICA-IA.md) e [POLITICA-DOCUMENTACAO](docs/00-governanca/POLITICA-DOCUMENTACAO.md), depois [Manual Vivo](docs/README.md), README raiz, piloto, ticket e capítulos afetados. Links não incluem conteúdo automaticamente. Preserve regras locais mais específicas.

A stack está aprovada; não reabrir a decisão. Consulte [ADR-003 aceito](docs/06-decisoes/ADR-003-stack-typescript.md). Não executar outro writer sem prova de término no workspace. Instruções anteriores e especificidades estão preservadas no snapshot.

## Codex
AGENTS.md é o ponto de entrada do Codex; confirmar hierarquia de instruções na versão instalada. Codex pode atuar como implementador ou revisor; papel é definido pelo ticket, não pela marca.
Adapter inicial usa codex exec com eventos JSONL, sandbox explícito e autenticação salva do cliente oficial na VPS. Validar --help e versão; não usar permissões amplas como padrão. Modelo efetivo vem de evidência do cliente, não de suposição.
Resume nativo só quando sessão/ambiente compatíveis; handoff para outro provider sempre usa estado externo. Não exportar auth.json ou tokens ao controle. Se API key estiver herdada, impedir uso no modo subscription-only.


## Fallback de carregamento

Descoberta automática nesta versão: NÃO VERIFICADA por nova sessão. Se não houver leitura comprovada, abrir este guia e as duas políticas explicitamente no contexto do job; registrar paths/hashes e omissões. Não ampliar permissões, instalar provider ou ler credenciais para testar. Regras de fixtures continuam locais.
