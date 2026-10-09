> Leitura: [← Anterior](00-README.md) · [Índice didático](../02-INDEX.md) · [Próximo →](02-ticket-execution.md)

# Navegar e configurar a fábrica

IMPLEMENTADO em a2cc5e0; evidência histórica por FAC-011/013–031. Verificação de software NOT_RUN nesta migração; aceite por ticket permanece no backlog real.

## Usuário e comportamento

Operador administrativo da fábrica. Home demonstrativa com SVG animado e menu persistente entre telas; sidebar inicia recolhida. Configurações em abas/modal com rascunho; agentes/skills por projeto, contas e modelos; login/verificação/PR têm fluxo explícito separado de salvar.

A navegação principal oferece Painel, Projetos, Tarefas, Agentes de IA, Núcleo IA, Pipeline, Revisões, Repositórios, Histórico, Escritório, Usuários e Configurações, nessa ordem. Os cinco itens acrescentados em FAC-034, Escritório e Usuários exibem prévia; não comprovam módulos implementados. [FAC-032](../09-entregas/2026/2026-10-07-FAC-032-menu-inicial-reduzido.md).

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

## Tema Centro de Comando — FAC-034

IMPLEMENTADO no diff da developer sobre de5dbfa: tema HUD comum, núcleo SVG acessível/determinístico, relógio e saudação locais; navegação/autorizações originais preservadas. Login com anel decorativo; mensagens mantêm conteúdo e role status, com marca visual OK/INFO/ATENÇÃO/ERRO oculta de leitores de tela. Inputs técnicos mono, foco visível, ações de pausa/cancelamento em rosa, tabelas/logs/estados vazios/abas/dialogs seguem os tokens. Os 17 estados de execução reais têm tom próprio; tarefas demonstrativas mantêm suas nove etapas separadas, sem criar enums do kit ilustrativo.

Critérios automatizados e limitações de browser na [entrega FAC-034](../09-entregas/2026/2026-10-07-FAC-034-centro-comando.md). Movimento reduzido por CSS; interações reais, fidelidade visual e revisão independente aguardam validação em ambiente que permita browser/porta local. Nenhuma API, regra de negócio ou credencial alterada.

## Nome dos agentes — FAC-035

Em Configurações → Equipes, abrir um agente e suas configurações permite editar Nome do agente. O cargo anterior continua apresentado separadamente; agentes personalizados permitem editar também o cargo. Salvar grava o nome no JSON versionado, cancelar descarta a edição. Nome pode ser removido, retornando à exibição do cargo, e admite até 100 caracteres após trim. [Funcionamento e evidências](../09-entregas/2026/2026-10-08-FAC-035-nomes-agentes.md).

## Integrações e escolha de IA/modelo — FAC-037

Adicionar conta e Cadastrar integração de IA abrem primeiro duas opções: Cadastrar chave de API e Cadastrar plano de assinatura (CLI). Cancelar descarta a escolha. API permite informar a chave num campo protegido; uma conta salva nunca revela o valor, e campo vazio mantém sua chave. Assinatura usa o fluxo oficial já existente.

Agentes personalizados e pré-configurados escolhem a integração habilitada no campo IA do agente e um modelo do catálogo dessa integração no campo Modelo da IA. Trocar a integração redefine o modelo. Sem cadastro habilitado, a tela orienta cadastrar uma integração; sem catálogo, orienta configurar seus modelos.

Cadastro API foi autorizado pelo responsável em 2026-10-09; não ativa execução ou fallback pago. O runtime atual continua CLI, e a tela informa que execução por API está indisponível. [Configuração](../03-modulos/configuracao/00-README.md#cadastro-api-ou-assinatura-cli--fac-037), [dados](../05-contratos/schemas/00-entidades.md#chaves-de-api-fac-037) e [entrega](../09-entregas/2026/2026-10-09-FAC-037-api-cli-agentes.md).
