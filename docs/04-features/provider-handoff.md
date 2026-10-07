# Selecionar cliente e transferir progresso

IMPLEMENTADO em a2cc5e0; evidência histórica por FAC-010C/012V/X/Y/AA. Verificação de software NOT_RUN nesta migração; aceite por ticket permanece no backlog real.

## Usuário e comportamento

Operador administrativo da fábrica. Configuração atual por função, instalação/modelo elegíveis; indisponibilidade conhecida após stop preserva snapshot. Até duas alternativas explícitas, outra worktree, restore/contexto; sem provider, WAITING_PROVIDER.

## Regras e critério

Critério: unknown não troca writer; conta/modelo não configurados não viram fallback. Handoff interno conserva lease/fence da tentativa; resume abre outra.

## Falhas e segurança

Auth/versão/digest/estado inválido interrompe a operação pertinente; informação do modelo não concede autoridade. Sem API de IA/extras/fallback/recarga. Gates de implantação e UID são independentes de comportamento codificado.

## Relações e evidências

[providers](../03-modulos/providers/README.md), [runtime](../03-modulos/runtime/README.md), [runtime-guard](../03-modulos/runtime-guard/README.md). [Contratos](../05-contratos/README.md), [ADRs](../06-decisoes/README.md), [entregas](../09-entregas/README.md), [aceites reais](../../BACKLOG.md).

## Limite

[AS-IS versus alvo](../02-arquitetura/as-is.md). Cenários de tenancy e broker dependem das propostas LF-MT; o catálogo FAC não prova seus controles.
