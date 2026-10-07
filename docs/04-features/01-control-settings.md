> Leitura: [← Anterior](00-README.md) · [Índice didático](../02-INDEX.md) · [Próximo →](02-ticket-execution.md)

# Navegar e configurar a fábrica

IMPLEMENTADO em a2cc5e0; evidência histórica por FAC-011/013–031. Verificação de software NOT_RUN nesta migração; aceite por ticket permanece no backlog real.

## Usuário e comportamento

Operador administrativo da fábrica. Home estática e menu persistente entre telas; sidebar inicia recolhida. Configurações em abas/modal com rascunho; agentes/skills por projeto, contas e modelos; login/verificação/PR têm fluxo explícito separado de salvar.

A navegação principal oferece Painel, Projetos, Tarefas, Agentes de IA, Escritório, Usuários e Configurações, nessa ordem. Escritório e Usuários exibem prévia; novos módulos serão acrescentados conforme evolução. [FAC-032](../09-entregas/2026/2026-10-07-FAC-032-menu-inicial-reduzido.md).

## Regras e critério

Critério: cancelar modal descarta campos, sem desfazer job já enviado; cadastro de skill/agente não executa código; PR depende de aprovação exata.

## Falhas e segurança

Auth/versão/digest/estado inválido interrompe a operação pertinente; informação do modelo não concede autoridade. Sem API de IA/extras/fallback/recarga. Gates de implantação e UID são independentes de comportamento codificado.

## Relações e evidências

[controle](../03-modulos/controle/00-README.md), [configuracao](../03-modulos/configuracao/00-README.md), [providers](../03-modulos/providers/00-README.md). [Contratos](../05-contratos/00-README.md), [ADRs](../06-decisoes/00-README.md), [entregas](../09-entregas/00-README.md), [aceites reais](../08-desenvolvimento/09-backlog.md).

## Limite

[AS-IS versus alvo](../02-arquitetura/01-as-is.md). Cenários de tenancy e broker dependem das propostas LF-MT; o catálogo FAC não prova seus controles.

## Painel Tarefas — demonstração FAC-033

IMPLEMENTADO como demonstração local: quadro com nove etapas e lista dos mesmos tickets, pesquisa por título/código/especificação, filtros por projeto/responsável/prioridade/fase/etapa, resumo recalculado para o filtro. Nova tarefa e edição permitem especificação, critérios por linha, prazo, dependências e responsável. Histórico registra criação, edições e mudanças de etapa. Fase do projeto e etapa do ticket são campos distintos.

O onboarding simulado cria projeto, depois cinco agentes habilitados e nove tickets atribuídos à equipe. A ação manual de atribuição automática usa o primeiro agente habilitado do projeto; a escolha por papel/skills pertence ao onboarding real futuro. Sem equipe habilitada, não há atribuição automática; rascunhos podem ficar sem responsável. Sessão administrativa ativa permite consultar projetos e agentes cadastrados por ID; nenhuma tarefa desta tela é enviada à fila real.

O aviso permanente identifica dados mockados. Simular onboarding recria exemplos mediante confirmação, preservando tarefas manuais. Remover tickets de exemplo limpa referências aos exemplos e preserva tarefas manuais/equipe. Exemplos editados continuam exemplos. Armazenamento local não disponível/corrompido é comunicado e não substituído silenciosamente. Multiusuário, sincronização entre abas, persistência PostgreSQL e geração/consumo pelo onboarding/worker real permanecem PLANEJADOS.

Fonte de dados e regras: [contrato da demonstração](../05-contratos/schemas/00-entidades.md#tarefas-demonstrativas-fac-033). [Entrega FAC-033](../09-entregas/2026/2026-10-07-FAC-033-painel-tarefas.md).
