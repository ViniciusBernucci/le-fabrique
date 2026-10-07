# Documentar e aceitar revisão exata

IMPLEMENTADO em a2cc5e0; evidência histórica por FAC-012Q/Z. Verificação de software NOT_RUN nesta migração; aceite por ticket permanece no backlog real.

## Usuário e comportamento

Operador administrativo da fábrica. Política documental configurada exige arquivos/seções/checks/base; gate estrutural e Reviewer vinculam docs ao snapshot final. Operador inspeciona diff/bundle/relatório e confirma digest/versão exatos.

## Regras e critério

Critério: evidência ausente/alterada recusa DONE; novo diff invalida gate/aceite pertinente.

## Falhas e segurança

Auth/versão/digest/estado inválido interrompe a operação pertinente; informação do modelo não concede autoridade. Sem API de IA/extras/fallback/recarga. Gates de implantação e UID são independentes de comportamento codificado.

## Relações e evidências

[documentation-gate](../03-modulos/documentation-gate/README.md), [approvals](../03-modulos/approvals/README.md). [Contratos](../05-contratos/README.md), [ADRs](../06-decisoes/README.md), [entregas](../09-entregas/README.md), [aceites reais](../../BACKLOG.md).

## Limite

[AS-IS versus alvo](../02-arquitetura/as-is.md). Cenários de tenancy e broker dependem das propostas LF-MT; o catálogo FAC não prova seus controles.
