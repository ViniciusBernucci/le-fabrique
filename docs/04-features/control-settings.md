# Navegar e configurar a fábrica

IMPLEMENTADO em a2cc5e0; evidência histórica por FAC-011/013–031. Verificação de software NOT_RUN nesta migração; aceite por ticket permanece no backlog real.

## Usuário e comportamento

Operador administrativo da fábrica. Home estática e menu persistente entre telas; sidebar inicia recolhida. Configurações em abas/modal com rascunho; agentes/skills por projeto, contas e modelos; login/verificação/PR têm fluxo explícito separado de salvar.

## Regras e critério

Critério: cancelar modal descarta campos, sem desfazer job já enviado; cadastro de skill/agente não executa código; PR depende de aprovação exata.

## Falhas e segurança

Auth/versão/digest/estado inválido interrompe a operação pertinente; informação do modelo não concede autoridade. Sem API de IA/extras/fallback/recarga. Gates de implantação e UID são independentes de comportamento codificado.

## Relações e evidências

[controle](../03-modulos/controle/README.md), [configuracao](../03-modulos/configuracao/README.md), [providers](../03-modulos/providers/README.md). [Contratos](../05-contratos/README.md), [ADRs](../06-decisoes/README.md), [entregas](../09-entregas/README.md), [aceites reais](../08-desenvolvimento/backlog.md).

## Limite

[AS-IS versus alvo](../02-arquitetura/as-is.md). Cenários de tenancy e broker dependem das propostas LF-MT; o catálogo FAC não prova seus controles.
