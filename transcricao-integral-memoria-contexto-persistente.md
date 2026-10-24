Esta é uma cópia de um chat compartilhado do ChatGPT. Isso não será adicionado à memória.

Denunciar conversa

A memória de contexto talvez seja uma das partes mais importantes de toda a arquitetura da nossa Fábrica de Software. Ela influencia diretamente o custo operacional, a qualidade do código, a consistência das regras de negócio, a velocidade de desenvolvimento e a capacidade de alternar entre Claude, Codex e Antigravity.

Minha proposta é que a fábrica tenha um subsistema próprio, que chamarei provisoriamente de Software Knowledge & Memory Engine (SKME).

A ideia central é esta:

> A memória do software não deve morar dentro de uma IA. Ela deve pertencer à Fábrica de Software, ser independente dos modelos, persistir entre execuções e fornecer a cada agente somente o conhecimento necessário para a tarefa.

Isso muda significativamente a forma como projetamos a fábrica.

Não precisaríamos ensinar o sistema inteiro ao Codex toda vez que ele implementasse uma feature. Também não precisaríamos explicar novamente as decisões arquiteturais ao Claude quando ele fosse revisar essa implementação.

Mais importante: um desenvolvimento realizado pelo Codex acrescentaria conhecimento à memória compartilhada, que estaria disponível ao Claude, ao Antigravity e a qualquer modelo que integrássemos futuramente.

## 1. O problema não é apenas o tamanho do contexto

Imagine um software com 300 mil linhas de código, dezenas de módulos, centenas de regras de negócio e anos de decisões arquiteturais.

Agora imagine que precisamos implementar uma funcionalidade relativamente pequena: quando um provedor de IA esgotar sua cota, a fábrica deverá interromper a execução, preservar o trabalho e tentar continuar com outro provedor.

Embora pareça simples, essa alteração envolve:

- O Provider Manager, que identifica a indisponibilidade.
    
- O orquestrador, que controla os estados da execução.
    
- O RuntimeGuard, que aplica os limites.
    
- O mecanismo de checkpoint e handoff.
    
- O worker, que precisa encerrar o processo anterior.
    
- O painel, que apresenta o estado atualizado.
    
- As regras de segurança, concorrência e documentação.
    

Uma IA precisaria compreender todas essas interações, mas não precisaria ler o sistema inteiro.

O verdadeiro desafio, portanto, não é somente diminuir tokens. É garantir que a fábrica consiga responder:

Quais informações são indispensáveis para implementar esta feature sem quebrar nenhuma regra, contrato ou dependência?

Há ainda outro problema: preservar o conhecimento adquirido.

Se amanhã substituirmos Codex por Claude, ou se uma sessão for encerrada inesperadamente, as decisões tomadas hoje não poderão desaparecer. E se uma regra de negócio mudar, a memória antiga não poderá continuar sendo apresentada como válida.

## 2. O que nossa arquitetura atual já resolve — e o que ainda falta

Revendo o planejamento v2.1, temos duas bases importantes.

O Context Builder, descrito na seção 6 da arquitetura, já prevê seleção de arquivos, regras, ADRs, testes, hashes e limitação de tokens. O handoff estabelece que PostgreSQL, Git e checkpoints mantenham o estado externo, sem depender da sessão privada de uma IA.

Fabrica-Software-Arquitetura-MVP-v2.pdf

Fabrica-Software-Arquitetura-MVP-v2.pdf

Entretanto, isso ainda é insuficiente para projetos realmente grandes.

O desenho atual não especifica como o sistema descobrirá relações entre regras de negócio, como manterá o conhecimento atualizado ao longo dos anos, como identificará informações contraditórias ou como decidirá quais informações cada modelo deve receber.

Minha recomendação é transformar o Context Builder em um componente de um sistema de memória muito mais amplo, em vez de tratá-lo apenas como um montador de prompts.

Há também uma inconsistência que precisamos corrigir na documentação: o PDF v2.1 ainda registra Laravel e Angular como stack da fábrica, embora nossa decisão posterior tenha sido React + NestJS + worker Node, todos em TypeScript.

Fabrica-Software-Arquitetura-MVP-v2.pdf

Isso é um exemplo real do tipo de divergência documental que o novo mecanismo deverá detectar e impedir que se propague para os agentes.

## 3. A arquitetura que proponho: memória em camadas

Não tentaria resolver tudo utilizando RAG, embeddings ou um banco vetorial. Essas tecnologias ajudam, mas isoladamente não resolvem o problema.

Precisamos combinar memória estruturada, documentação versionada, análise de código, relações entre componentes e recuperação seletiva de conhecimento.

Arquitetura conceitual do Software Knowledge & Memory Engine

![](data:image/svg+xml;charset=utf-8,%3Csvg%20font-family%3D%22-apple-system-body%2C%20ui-sans-serif%2C%20-apple-system%2C%20system-ui%2C%20%26quot%3BSegoe%20UI%26quot%3B%2C%20Helvetica%2C%20%26quot%3BApple%20Color%20Emoji%26quot%3B%2C%20Arial%2C%20sans-serif%2C%20%26quot%3BSegoe%20UI%20Emoji%26quot%3B%2C%20%26quot%3BSegoe%20UI%20Symbol%26quot%3B%22%20font-weight%3D%22400%22%20data-d-component%3D%22svg%22%20fill%3D%22currentColor%22%20style%3D%22color%3Argb\(255%2C%20255%2C%20255\)%22%20viewBox%3D%220%200%20340%20330%22%20width%3D%22100%25%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20x%3D%2283%22%20y%3D%228%22%20width%3D%22174%22%20height%3D%2238%22%20rx%3D%229%22%20fill%3D%22%232563eb%22%2F%3E%3Ctext%20x%3D%22170%22%20y%3D%2223%22%20font-size%3D%2212%22%20fill%3D%22white%22%20text-anchor%3D%22middle%22%20font-weight%3D%22600%22%3ETicket%20%2F%20Feature%3C%2Ftext%3E%3Ctext%20x%3D%22170%22%20y%3D%2236%22%20font-size%3D%229%22%20fill%3D%22%23dbeafe%22%20text-anchor%3D%22middle%22%3EObjetivo%20%2B%20crit%C3%A9rios%20de%20aceite%3C%2Ftext%3E%3Cpath%20d%3D%22M170%2046%20V66%22%20stroke%3D%22currentColor%22%20opacity%3D%22.6%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M165%2060%20L170%2066%20L175%2060%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20opacity%3D%22.6%22%2F%3E%3Crect%20x%3D%2274%22%20y%3D%2268%22%20width%3D%22192%22%20height%3D%2244%22%20rx%3D%229%22%20fill%3D%22%230f766e%22%2F%3E%3Ctext%20x%3D%22170%22%20y%3D%2285%22%20font-size%3D%2212%22%20fill%3D%22white%22%20text-anchor%3D%22middle%22%20font-weight%3D%22600%22%3EMemory%20%26amp%3B%20Context%20Engine%3C%2Ftext%3E%3Ctext%20x%3D%22170%22%20y%3D%2299%22%20font-size%3D%229%22%20fill%3D%22%23ccfbf1%22%20text-anchor%3D%22middle%22%3EBusca%2C%20impacto%20e%20prioriza%C3%A7%C3%A3o%3C%2Ftext%3E%3Crect%20x%3D%228%22%20y%3D%22130%22%20width%3D%22102%22%20height%3D%2247%22%20rx%3D%227%22%20stroke%3D%22currentColor%22%20stroke-opacity%3D%22.2%22%20fill%3D%22%2364748b%22%20fill-opacity%3D%22.1%22%2F%3E%3Ctext%20x%3D%2259%22%20y%3D%22148%22%20text-anchor%3D%22middle%22%20font-size%3D%2210%22%20fill%3D%22currentColor%22%20font-weight%3D%22600%22%3ERegras%20e%3C%2Ftext%3E%3Ctext%20x%3D%2259%22%20y%3D%22161%22%20text-anchor%3D%22middle%22%20font-size%3D%2210%22%20fill%3D%22currentColor%22%3Edecis%C3%B5es%3C%2Ftext%3E%3Cpath%20d%3D%22M59%20130%20V120%20H170%20V112%22%20stroke%3D%22currentColor%22%20opacity%3D%22.4%22%20stroke-width%3D%221.2%22%20fill%3D%22none%22%2F%3E%3Crect%20x%3D%22119%22%20y%3D%22130%22%20width%3D%22102%22%20height%3D%2247%22%20rx%3D%227%22%20stroke%3D%22currentColor%22%20stroke-opacity%3D%22.2%22%20fill%3D%22%2364748b%22%20fill-opacity%3D%22.1%22%2F%3E%3Ctext%20x%3D%22170%22%20y%3D%22148%22%20text-anchor%3D%22middle%22%20font-size%3D%2210%22%20fill%3D%22currentColor%22%20font-weight%3D%22600%22%3EGrafo%20de%3C%2Ftext%3E%3Ctext%20x%3D%22170%22%20y%3D%22161%22%20text-anchor%3D%22middle%22%20font-size%3D%2210%22%20fill%3D%22currentColor%22%3Edepend%C3%AAncias%3C%2Ftext%3E%3Cpath%20d%3D%22M170%20130%20V120%20H170%20V112%22%20stroke%3D%22currentColor%22%20opacity%3D%22.4%22%20stroke-width%3D%221.2%22%20fill%3D%22none%22%2F%3E%3Crect%20x%3D%22230%22%20y%3D%22130%22%20width%3D%22102%22%20height%3D%2247%22%20rx%3D%227%22%20stroke%3D%22currentColor%22%20stroke-opacity%3D%22.2%22%20fill%3D%22%2364748b%22%20fill-opacity%3D%22.1%22%2F%3E%3Ctext%20x%3D%22281%22%20y%3D%22148%22%20text-anchor%3D%22middle%22%20font-size%3D%2210%22%20fill%3D%22currentColor%22%20font-weight%3D%22600%22%3EC%C3%B3digo%20e%3C%2Ftext%3E%3Ctext%20x%3D%22281%22%20y%3D%22161%22%20text-anchor%3D%22middle%22%20font-size%3D%2210%22%20fill%3D%22currentColor%22%3Econtratos%3C%2Ftext%3E%3Cpath%20d%3D%22M281%20130%20V120%20H170%20V112%22%20stroke%3D%22currentColor%22%20opacity%3D%22.4%22%20stroke-width%3D%221.2%22%20fill%3D%22none%22%2F%3E%3Cpath%20d%3D%22M170%20177%20V194%22%20stroke%3D%22currentColor%22%20opacity%3D%22.6%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M165%20189%20L170%20195%20L175%20189%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20opacity%3D%22.6%22%2F%3E%3Crect%20x%3D%2278%22%20y%3D%22197%22%20width%3D%22184%22%20height%3D%2237%22%20rx%3D%228%22%20fill%3D%22%232563eb%22%20fill-opacity%3D%22.12%22%20stroke%3D%22%232563eb%22%2F%3E%3Ctext%20x%3D%22170%22%20y%3D%22212%22%20font-size%3D%2211%22%20text-anchor%3D%22middle%22%20fill%3D%22currentColor%22%20font-weight%3D%22600%22%3EContext%20Pack%20versionado%3C%2Ftext%3E%3Ctext%20x%3D%22170%22%20y%3D%22225%22%20font-size%3D%229%22%20text-anchor%3D%22middle%22%20fill%3D%22currentColor%22%3ESomente%20contexto%20necess%C3%A1rio%3C%2Ftext%3E%3Cpath%20d%3D%22M170%20234%20V250%20M52%20250%20H288%20M52%20250%20V261%20M170%20250%20V261%20M288%20250%20V261%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-opacity%3D%22.55%22%20stroke-width%3D%221.4%22%2F%3E%3Crect%20x%3D%228%22%20y%3D%22263%22%20width%3D%22102%22%20height%3D%2230%22%20rx%3D%227%22%20fill%3D%22%2364748b%22%20fill-opacity%3D%22.12%22%20stroke%3D%22currentColor%22%20stroke-opacity%3D%22.25%22%2F%3E%3Ctext%20x%3D%2259%22%20y%3D%22282%22%20font-size%3D%2211%22%20text-anchor%3D%22middle%22%20font-weight%3D%22600%22%20fill%3D%22currentColor%22%3ECodex%3C%2Ftext%3E%3Crect%20x%3D%22119%22%20y%3D%22263%22%20width%3D%22102%22%20height%3D%2230%22%20rx%3D%227%22%20fill%3D%22%2364748b%22%20fill-opacity%3D%22.12%22%20stroke%3D%22currentColor%22%20stroke-opacity%3D%22.25%22%2F%3E%3Ctext%20x%3D%22170%22%20y%3D%22282%22%20font-size%3D%2211%22%20text-anchor%3D%22middle%22%20font-weight%3D%22600%22%20fill%3D%22currentColor%22%3EClaude%3C%2Ftext%3E%3Crect%20x%3D%22230%22%20y%3D%22263%22%20width%3D%22102%22%20height%3D%2230%22%20rx%3D%227%22%20fill%3D%22%2364748b%22%20fill-opacity%3D%22.12%22%20stroke%3D%22currentColor%22%20stroke-opacity%3D%22.25%22%2F%3E%3Ctext%20x%3D%22281%22%20y%3D%22282%22%20font-size%3D%2211%22%20text-anchor%3D%22middle%22%20font-weight%3D%22600%22%20fill%3D%22currentColor%22%3EAntigravity%3C%2Ftext%3E%3Cpath%20d%3D%22M288%20293%20V307%20H170%22%20stroke%3D%22%230f766e%22%20stroke-width%3D%221.4%22%20stroke-dasharray%3D%224%203%22%20fill%3D%22none%22%2F%3E%3Cpath%20d%3D%22M176%20302%20L170%20307%20L176%20312%22%20stroke%3D%22%230f766e%22%20stroke-width%3D%221.4%22%20fill%3D%22none%22%2F%3E%3Ctext%20x%3D%22163%22%20y%3D%22311%22%20text-anchor%3D%22end%22%20fill%3D%22%230f766e%22%20font-size%3D%229%22%20font-weight%3D%22600%22%3EMudan%C3%A7as%20validadas%20retornam%20%C3%A0%20mem%C3%B3ria%3C%2Ftext%3E%3C%2Fsvg%3E)O conhecimento é compartilhado pela fábrica. Cada provedor recebe um recorte consistente da mesma base, com as mesmas fontes e versões.

### Os seis tipos de memória

|Tipo|O que armazena|Persistência|
|---|---|---|
|1. Memória institucional|Políticas, padrões, arquitetura, restrições globais|Permanente, versionada|
|2. Memória de negócio|Domínios, regras, entidades, fluxos e exceções|Permanente, evolutiva|
|3. Memória de relações|Dependências entre módulos, arquivos, serviços e regras|Atualizada conforme o código|
|4. Memória de decisões|ADRs, justificativas, alternativas descartadas e histórico|Histórico imutável, com versões vigentes|
|5. Memória operacional|Tickets, estados, checkpoints, testes, entregas e pendências|Persistente e auditável|
|6. Memória de trabalho|Contexto selecionado para determinada execução|Temporária, mas recuperável|

A separação é fundamental. Uma decisão arquitetural aceita não deve ser tratada como uma observação passageira feita por um agente durante uma sessão.

Da mesma forma, um resumo de execução não deveria se tornar automaticamente uma regra oficial de negócio.

## 4. A peça mais importante: um grafo de conhecimento e dependências

Este é o componente que considero mais estratégico.

Imagine que um agente encontre a seguinte regra:

> Quando o provedor de IA atingir seu limite, a execução deverá ser interrompida sem perder o trabalho já realizado.

Uma pesquisa semântica consegue localizar documentos semelhantes a esse texto. Entretanto, talvez não encontre uma regra em outro documento que diga:

> Nenhuma nova execução poderá escrever no mesmo workspace antes da confirmação de encerramento do processo anterior.

As duas regras estão diretamente relacionadas, mesmo que usem palavras diferentes.

Por isso, eu implementaria um Knowledge Graph, ou grafo de conhecimento, integrado à base documental e ao código.

Ele manteria relações como:

Exemplo: dependências da regra de esgotamento de cota

REGRA-QUOTA-001

Interromper com segurança ao esgotar cota

Provider Manager

Detecta indisponibilidade

RuntimeGuard

Bloqueia novas tentativas

Checkpoint

Preserva alterações

Worker

Confirma encerramento

Orquestrador

Transiciona estado

Handoff

Retoma com outro modelo

O mecanismo não precisaria perguntar a um modelo complexo quais módulos estão relacionados toda vez. Ele consultaria as relações já registradas, complementando com análise estática do código.

Por exemplo:

`REGRA-QUOTA-001` → implementada por → `ProviderManager`

`ProviderManager` → utilizado por → `Orchestrator`

`Orchestrator` → depende de → `CheckpointService`

`CheckpointService` → validado por → `handoff.spec.ts`

Isso permite que a fábrica descubra automaticamente a abrangência de uma alteração.

E há uma vantagem ainda maior: análise de impacto antes de desenvolver.

O Tech Lead recebe a feature, consulta o grafo e identifica quais domínios serão afetados. Se uma alteração exigir uma regra de outro setor, essa regra entra no contexto mesmo que não compartilhe palavras com o ticket.

O grafo, porém, não seria a única fonte. Uma relação gerada automaticamente pelo código pode estar incompleta, especialmente quando há eventos, filas, reflexão ou dependências dinâmicas. Por isso, ela deve ser complementada por contratos e regras explícitas.

## 5. Como encontrar informações sem consumir uma fortuna

Eu usaria um mecanismo de recuperação híbrido, executado preferencialmente por algoritmos tradicionais antes de acionar qualquer IA.

### Pesquisa em três níveis

Nível 1 — Pesquisa determinística

`ripgrep`, índices textuais do PostgreSQL, caminhos, imports, símbolos, nomes de classes, testes e metadados de domínio. É extremamente barato e costuma ser suficiente para localizar informações explícitas.

Nível 2 — Expansão por dependências

O grafo acrescenta as regras e componentes relacionados aos resultados encontrados. Ele pode percorrer um ou dois níveis de dependência, respeitando um limite de relevância.

Nível 3 — Recuperação semântica

Embeddings e busca vetorial localizam conhecimento conceitualmente semelhante, ainda que descrito com outras palavras. Um reranqueamento opcional combina os resultados com importância, atualidade e confiabilidade.

Essa ordem é importante para reduzir custos.

Não quero que a fábrica chame uma LLM para descobrir se determinada classe importa outra classe. Isso pode ser identificado estaticamente.

No nosso ecossistema TypeScript, podemos usar o TypeScript Compiler API e `ts-morph` para extrair símbolos, imports, referências e estruturas. O Tree-sitter também é uma alternativa para análises incrementais e linguagens adicionais.

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

Para a busca semântica, começaria com PostgreSQL + `pgvector`, sem adicionar imediatamente Qdrant, Elasticsearch ou Neo4j. O pgvector permite armazenar embeddings no próprio PostgreSQL e combiná-los com pesquisa textual.

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

Minha decisão seria: primeiro demonstrar que a busca determinística e o grafo funcionam; depois adicionar embeddings quando houver evidência de que estamos perdendo informações relevantes.

Isso evita construir uma infraestrutura sofisticada que talvez não seja necessária no MVP.

## 6. Context Packs: a solução para não enviar tudo à LLM

O resultado da recuperação seria um objeto que chamarei de Context Pack, ou pacote de contexto.

Ele não conteria uma cópia da documentação. Seria uma seleção fundamentada das informações que o agente realmente precisa.

Seu conteúdo incluiria as regras obrigatórias, as decisões arquiteturais pertinentes, as relações com outros domínios, os contratos envolvidos, os trechos de código relevantes, os testes e os critérios de aceite.

Cada item teria referência à fonte original e à revisão correspondente.

Um manifesto simplificado poderia ser:

```
context_pack:
  ticket: FAC-EXEMPLO
  project: fabrica-software
  base_sha: <git-sha-verificado>

  mandatory:
    - politica-global
    - contrato-ticket
    - restricoes-seguranca

  domains:
    - provider-manager
    - orchestration
    - handoff

  related_rules:
    - RULE-QUOTA-001
    - RULE-WRITER-002

  source_revisions:
    rules_version: 12
    code_revision: <git-sha-verificado>

  limits:
    target_tokens: 12000
    expansion_allowed: true

  validation:
    conflicts: []
    critical_rules_covered: true
```

Os nomes e valores são exemplos de contrato, não componentes já implementados.

### Carregamento progressivo de contexto

Não enviaria tudo no começo.

Primeiro, a IA receberia um Context Pack compacto. Durante a implementação, se precisasse de mais informações, poderia solicitar novos trechos à fábrica.

Por exemplo, o Codex recebe uma regra dizendo que um worker precisa ser encerrado antes de um handoff. Se precisar entender como o encerramento funciona, solicita o contrato e o trecho específico de código.

Isso é um tipo de progressive disclosure: revelar informação progressivamente conforme a necessidade.

Os clientes oficiais de IA já possuem mecanismos próprios de leitura de arquivos e recuperação de contexto. A fábrica não deve pressupor que controla todo o contexto interno desses clientes. Ela deve controlar as fontes disponíveis, a seleção inicial, as ferramentas permitidas e medir o que for observável.

### Orçamento adaptativo por complexidade

Eu proporia estes limites iniciais de engenharia, sujeitos a medição:

|Tipo de tarefa|Contexto inicial sugerido|
|---|---|
|R0/R1 — alterações locais e simples|3–8 mil tokens|
|R2 — integrações entre domínios|8–20 mil tokens|
|R3/R4 — mudanças críticas|20–40 mil tokens, quando necessário|

R3/R4 continuam fora do primeiro piloto autônomo, conforme nosso planejamento. Também não trataríamos esses números como limites rígidos que autorizam omitir uma regra crítica.

Se o contexto relevante não couber, o agente deverá dividir o trabalho ou solicitar contexto adicional. Não deve simplesmente perder informações para cumprir um orçamento arbitrário.

## 7. Como a memória se atualiza sem ficar obsoleta

Aqui está um dos maiores riscos dessa arquitetura.

Uma memória barata, mas desatualizada, pode fazer a IA repetir erros sistematicamente.

Imagine que alteramos o processo de autenticação. A implementação nova funciona, mas o sistema de memória continua descrevendo a arquitetura anterior. A próxima IA pode desfazer a mudança ou implementar outra feature seguindo regras obsoletas.

Para evitar isso, proponho um fluxo de atualização transacional e versionado.

Ciclo de atualização da memória

1

1. Alteração de código

A feature modifica arquivos, contratos ou comportamentos

2

2. Análise do diff

O indexador identifica símbolos, dependências e domínios afetados

3

3. Propostas de memória

O agente sugere novas regras, relações e alterações documentais

4

4. Validação

Testes, documentação, regras de consistência e revisão verificam as propostas

5

5. Publicação

Após aceite e incorporação da revisão, o conhecimento vigente é atualizado

6

6. Invalidação seletiva

Somente índices e Context Packs afetados são regenerados

O ponto decisivo é que o agente pode propor uma alteração na memória, mas não deve poder transformar livremente uma suposição em verdade oficial.

Separaria claramente três situações: conhecimento confirmado, conhecimento proposto e conhecimento obsoleto ou conflitante.

Uma regra de negócio precisa ter origem, versão, domínio responsável e evidências. Uma decisão explicitamente aceita por você não deve ser substituída apenas porque o código atual contém algo diferente.

Na verdade, quando código e documentação discordarem, o sistema deverá gerar um alerta de divergência.

Há uma diferença importante entre dizer que o código faz determinada coisa e que o negócio exige aquela coisa. O código pode conter um bug; a documentação pode estar desatualizada. Nenhum dos dois deve prevalecer automaticamente em todos os casos.

### Versionamento e branches

Outro detalhe: uma feature em desenvolvimento não pode modificar a memória oficial do projeto antes de ser aceita.

Eu manteria a memória vigente vinculada a uma revisão de referência do Git. Cada branch ou worktree teria uma sobreposição temporária das próprias mudanças, identificada por SHA e hash do patch.

Quando a alteração fosse aceita e incorporada, atualizaríamos a versão vigente da memória.

Isso evita que um agente trabalhando em uma feature inacabada contamine o contexto de outro agente.

Também permitiria voltar a uma revisão antiga e reconstruir qual era o conhecimento válido naquele momento.

## 8. Como compartilhar a mesma memória entre Claude, Codex e Antigravity

Essa é uma das maiores vantagens do desenho.

A memória não ficaria em arquivos específicos do Claude ou em uma sessão de conversa do Codex.

Os arquivos `CLAUDE.md`, `AGENTS.md` e `ANTIGRAVITY.md` seriam apenas portas de entrada para políticas e mecanismos de consulta compartilhados.

O conhecimento continuaria armazenado na fábrica.

Codex

Claude

Antigravity

Memory Gateway

Interface neutra de consulta e preparação de contexto

PostgreSQL

Dados e relações

Git

Código e documentos

Índices

Busca e referências

O Memory Gateway exporia operações como `searchContext`, `getRule`, `getRelatedComponents`, `getDecisionHistory`, `getSourceExcerpt` e `proposeMemoryUpdate`.

Poderíamos oferecer essas operações por uma API interna em NestJS e, futuramente, por um servidor MCP, caso os clientes oficiais suportem o mecanismo com segurança na configuração instalada.

Para o MVP, um arquivo de Context Pack gerado pela fábrica e disponibilizado ao CLI pode ser suficiente. Não precisamos depender de uma integração sofisticada para provar a portabilidade.

### Exemplo real de troca entre modelos

Suponha que o Codex tenha implementado 70% da funcionalidade e atingido sua cota.

A fábrica encerra o processo com segurança, guarda as alterações no checkpoint e persiste um resumo objetivo do trabalho: decisões, arquivos afetados, testes realizados, dificuldades e próximos passos.

Quando o Claude assume, a fábrica gera um novo Context Pack com o mesmo contrato de negócio e as mesmas regras, mas acrescenta o checkpoint e o estado atual do Git.

O Claude não precisa ler a conversa inteira do Codex.

Também não precisa reanalisar todo o repositório. Ele recebe o que foi feito, onde está o trabalho e quais evidências precisam ser verificadas.

Isso é continuidade de desenvolvimento entre modelos sem transferência de memória interna.

Não podemos, entretanto, garantir que dois modelos interpretem tudo da mesma maneira. A consistência precisa ser demonstrada por contratos, testes e evidências — não pela promessa de que receberam um resumo semelhante.

## 9. Como reduzir o consumo de contexto na prática

Agora podemos avaliar o potencial de economia.

Considere um cenário puramente ilustrativo: oito chamadas de IA necessárias para concluir uma feature.

Simulação de tokens de contexto enviados

Sem seleção de contexto

# 960 mil

120 mil × 8 chamadas

Com Context Packs

# 96 mil

12 mil × 8 chamadas

Redução hipotética no contexto enviado

## 90%

10% enviado90% evitado

Exemplo matemático, não benchmark. A economia real depende das leituras adicionais, ferramentas internas do CLI, qualidade do contexto e número de correções.

A redução de tokens não é necessariamente a mesma coisa que redução de dinheiro.

Na nossa arquitetura atual, a fábrica utiliza assinaturas e clientes oficiais, sem APIs pagas por token no MVP. Portanto, o benefício principal inicialmente será preservar cotas, diminuir latência, evitar releituras e reduzir retrabalho, não necessariamente diminuir uma fatura proporcionalmente aos tokens.

Uma chamada curta que provoca três correções pode sair operacionalmente pior do que uma chamada maior que conclui o trabalho corretamente.

O objetivo é minimizar o custo por feature corretamente entregue, e não minimizar tokens a qualquer preço.

### Cache: útil, mas não é a memória do projeto

Precisamos distinguir o cache de contexto interno da fábrica do prompt caching oferecido pelos provedores.

O cache interno pode guardar seleções de fontes e Context Packs por revisão, reutilizando o resultado em tarefas equivalentes.

Já o prompt caching do provedor pode reaproveitar partes estáveis de requisições, reduzindo latência e, em determinadas modalidades de API, custo de entrada. A documentação oficial da OpenAI descreve esse mecanismo, mas suas condições variam conforme o modelo e a modalidade de uso.

![](https://www.google.com/s2/favicons?domain=https://developers.openai.com&sz=32)

OpenAI API

Não devemos supor que o cache do Codex é compartilhado com o Claude, nem que uma assinatura oferece os mesmos descontos e controles de uma API.

Por isso, o cache dos fornecedores será uma otimização secundária, nunca o fundamento da persistência da memória.

## 10. Como implementaria isso na nossa stack

Manteria o ecossistema TypeScript que escolhemos e evitaria adicionar uma pilha complexa de infraestrutura logo no início.

|Componente|Tecnologia proposta|Responsabilidade|
|---|---|---|
|Memory API|NestJS + TypeScript|Consultas, contratos, permissões|
|Memory Store|PostgreSQL|Regras, entidades, decisões, relações e revisões|
|Code Indexer|Node + ts-morph|Extração de símbolos e dependências|
|Search Engine|PostgreSQL FTS + ripgrep|Busca textual e estrutural|
|Vector Search|pgvector, opcional|Similaridade semântica|
|Context Builder|Worker Node/TypeScript|Seleção e montagem dos pacotes|
|Context Cache|PostgreSQL e Redis opcional|Reutilização por versão|
|Knowledge Updater|Worker + Git hooks/CI|Atualização incremental validada|
|Portabilidade|Context Packs + adapters|Claude, Codex e Antigravity|

O PostgreSQL armazenaria metadados e relações. O Git continuaria sendo a fonte versionada de código, documentação e decisões.

Isso é importante para evitar criar duas fontes de verdade.

Os índices de código seriam reconstruíveis a partir do Git. As regras de negócio e ADRs teriam fontes identificáveis, e o banco serviria para pesquisá-los rapidamente.

Não começaria usando Neo4j. Podemos modelar um grafo de tamanho moderado com tabelas de nós e relações no próprio PostgreSQL. Um banco de grafos especializado só deveria entrar quando consultas e volumes justificassem essa complexidade.

Também não contrataria obrigatoriamente um serviço de embeddings. Podemos iniciar sem vetores e avaliar posteriormente um modelo local pequeno na VPS. Isso consumiria CPU/RAM, portanto exigiria medição junto aos limites já previstos para o worker.

## 11. Os cuidados que impedirão a memória de prejudicar o projeto

Existem alguns requisitos que eu consideraria inegociáveis.

Rastreabilidade. Toda informação importante apresentada a um agente deve poder ser associada a um documento, trecho de código, teste ou decisão, com sua versão. Um resumo não pode ser a única evidência de uma regra crítica.

Isolamento. O índice deve respeitar projeto, permissões e escopo. Segredos, tokens, dumps sensíveis e arquivos explicitamente excluídos não devem entrar na memória nem nas consultas aos provedores.

Detecção de conflitos. Uma regra de negócio nova que contradiz uma decisão aceita deve gerar um bloqueio ou solicitação de revisão, não uma substituição silenciosa.

Atualização incremental. Alterar dois arquivos não pode exigir reindexar o repositório inteiro ou reescrever todas as documentações. O mecanismo deve localizar o que mudou e invalidar apenas conhecimento afetado.

Qualidade da recuperação. Precisaremos de um conjunto de tickets com fontes relevantes conhecidas para medir quantas regras críticas o Context Builder encontra. Se economizarmos 80% dos tokens, mas omitirmos uma regra de segurança, o sistema falhou.

Auditabilidade. Devemos conseguir responder quais regras, versões e documentos foram entregues ao modelo durante determinada execução. Isso será fundamental para investigar uma implementação incorreta.

## 12. Como incorporaria essa arquitetura ao MVP

Eu não construiria o mecanismo completo de uma vez. Nossa documentação atual contempla o FAC-006 — Context Builder e RuntimeGuard — com apenas 1 a 2 dias estimados.

PLANO-MVP.md

Esse prazo é compatível com um seletor inicial relativamente simples, não com uma memória persistente multimodelo completa.

Minha proposta é expandir esse trabalho progressivamente.

Evolução proposta da memória

Planejamento

Fase 1 — Fundação documental

Contrato da memória, regras por domínio, referências, versões e manifestos de contexto. Busca determinística, sem embeddings.

Primeiro piloto de Context Builder

Fase 2 — Conhecimento estrutural

Indexação de código TypeScript, relações entre componentes, entidades e testes. Análise de impacto antes da implementação.

Integração com o desenvolvimento de features

Fase 3 — Memória viva e multimodelo

Atualização por diff, conflitos, invalidação seletiva, Context Packs portáveis e handoff consistente entre provedores.

Integrar FAC-010 e FAC-011

Fase 4 — Recuperação inteligente

Busca vetorial, reranqueamento, avaliação da relevância, ajuste automático de limites e otimização com dados de uso reais.

Somente após validar necessidade e custo-benefício

Nesse desenho, a primeira feature da própria fábrica já poderia testar um Context Pack pequeno. Conforme o projeto avança, o mesmo mecanismo evoluiria, sem precisar descartar a memória construída anteriormente.

A aceitação dessa arquitetura deve incluir testes especialmente difíceis: alteração que atravessa módulos sem imports diretos, regra contraditória em documento antigo, handoff após interrupção, mudança documental não aprovada e indexação de branch com código ainda não incorporado.

Esses casos são muito mais importantes do que demonstrar uma busca semântica aparentemente inteligente.

## 13. Minha proposta de decisão arquitetural

Eu adotaria o SKME como subsistema obrigatório da Fábrica de Software, com cinco princípios:

|Princípio|Decisão|
|---|---|
|Propriedade|A memória pertence à fábrica, não aos provedores|
|Persistência|Git para fontes versionadas; PostgreSQL para dados, relações e estado|
|Recuperação|Determinística primeiro, grafo depois, semântica conforme necessidade|
|Consistência|Atualização validada, com evidências e revisão vinculada|
|Economia|Contexto progressivo, limites adaptativos e medição por entrega aceita|

A decisão mais importante é que não precisamos construir uma IA para lembrar do desenvolvimento: precisamos construir uma infraestrutura de conhecimento que permita às IAs trabalhar sem ter de reaprender o software a cada tarefa.

É uma diferença grande. O conhecimento técnico e de negócio se acumula com o tempo, mas não precisa ocupar a janela de contexto de todos os agentes.

Vejo isso também como um diferencial importante do produto. Uma fábrica autônoma que apenas gera código é relativamente fácil de reproduzir. Uma fábrica que preserva decisões, compreende dependências, detecta contradições e consegue transferir trabalho entre modelos com rastreabilidade possui uma capacidade muito mais valiosa.

O próximo passo que considero essencial é especificar o contrato dessa memória antes de implementar o mecanismo de busca. Precisamos definir formalmente o que é uma regra, uma decisão, uma relação, uma evidência, uma versão e um Context Pack. Com esses contratos bem definidos, a recuperação, a atualização e o compartilhamento entre modelos tornam-se partes de uma arquitetura coerente, em vez de soluções isoladas que precisaremos corrigir no futuro.

Sim. O JEV pode ter um papel muito interessante na arquitetura da nossa Fábrica de Software, especialmente como um motor de decisões para navegar pelo conhecimento do projeto. E eu ampliaria sua utilização para além da seleção de contexto.

Mas faria uma distinção fundamental:

> O código determinístico descobre o que é obrigatório e quais opções são válidas. O JEV decide entre alternativas quando existe incerteza. As LLMs maiores entram quando é necessário raciocinar, projetar ou implementar.

Essa divisão nos permite utilizar inteligência artificial de maneira muito mais econômica e previsível.

O JEV, da TypeSafe AI, foi desenvolvido justamente para decisões estruturadas: `Choice` (escolha), `Score` (pontuação) e `Noul` (julgamento probabilístico de sim/não). Em vez de gerar longos textos, retorna resultados tipados que o software pode utilizar diretamente.

![](https://www.google.com/s2/favicons?domain=https://typesafe.ai&sz=32)

TypeSafe AI Blog

+1

## 1. Como encaixaria o JEV no nosso sistema de memória

Eu dividiria o Software Knowledge & Memory Engine (SKME) em três camadas de decisão.

Nova feature ou ticket

Objetivo, escopo, critérios de aceite

Camada 1 — Determinística

Localiza regras, índices, contratos, imports, dependências e caminhos obrigatórios

Camada 2 — JEV

Classifica intenção, seleciona caminhos ambíguos, prioriza fontes e avalia relevância

Context Pack validado

Fontes essenciais, regras e relações versionadas

Camada 3 — Claude / Codex / Antigravity

Raciocínio, desenvolvimento e revisão

O detalhe é que eu não chamaria o JEV em cada nó da árvore. Isso pode transformar uma arquitetura econômica em centenas de chamadas desnecessárias.

Usaria o JEV para selecionar entre conjuntos de caminhos candidatos, principalmente quando os algoritmos tradicionais não conseguirem diferenciar bem as opções.

## 2. Exemplo: navegar em uma árvore de contexto

Imagine que a fábrica recebe esta feature:

Implementar a troca automática de agente quando o provedor atingir seu limite de utilização, garantindo que nenhuma alteração de código seja perdida.

Nosso grafo contém:

Exemplo de árvore de domínios

Fábrica de Software

Autenticação

Usuários, tokens e permissões

Providers

Cotas, disponibilidade e seleção

Orquestração

Estados, execuções e transições

Persistência

Dados, checkpoints e artefatos

Interface

Painel, alertas e indicadores

Exemplo interativo de seleção de domínios. Os três caminhos inicialmente destacados são candidatos relevantes; esta não é uma inferência real do JEV. Clique para experimentar outras combinações.

Nesse cenário, uma análise determinística encontra `ProviderManager`, `Orchestrator` e `CheckpointService`, porque o ticket cita comportamentos diretamente relacionados aos contratos desses componentes.

O JEV poderia atuar quando houver dúvida entre caminhos adicionais. Por exemplo:

Choice: qual domínio deve ser investigado a seguir — observabilidade, autenticação ou interface?

Score: quão relevante é determinado documento para esta tarefa?

Noul: há indícios de que este ticket afeta um fluxo de recuperação não identificado pelos índices?

Entretanto, a decisão do JEV não seria uma autorização para ignorar uma regra obrigatória. Se o grafo identifica que `CheckpointService` depende de uma política de segurança, essa política entra no Context Pack independentemente da pontuação do JEV.

A consequência é importante: o JEV ajuda a descobrir e priorizar contexto, mas não determina sozinho o que pode ser esquecido.

## 3. O que pode ser 100% determinístico?

Muita coisa. E essa é a parte que eu mais exploraria antes de adicionar qualquer novo modelo.

Um mecanismo determinístico não precisa compreender linguagem natural como uma LLM. Ele aplica algoritmos, regras formais e estruturas verificáveis.

Veja como dividiria as responsabilidades:

|Operação|Determinístico?|JEV necessário?|
|---|---|---|
|Identificar arquivos modificados no Git|Sim|Não|
|Extrair imports e dependências TypeScript|Sim|Não|
|Descobrir classes e métodos referenciados|Sim, com limites de análise estática|Não|
|Localizar contratos de um domínio conhecido|Sim|Não|
|Percorrer relações existentes no grafo|Sim|Não|
|Identificar regras marcadas como obrigatórias|Sim|Não|
|Verificar versões e hashes|Sim|Não|
|Classificar uma solicitação ambígua em domínios|Nem sempre|Pode ajudar|
|Escolher o documento mais relevante semanticamente|Parcialmente|Pode ajudar|
|Detectar possível impacto indireto não catalogado|Parcialmente|Pode ajudar|
|Resolver contradições complexas de negócio|Não em geral|Exige análise adicional|
|Decidir se testes realmente comprovam um requisito|Parcialmente|LLM/revisão quando necessário|

### Um mecanismo determinístico de relevância

Podemos construir um algoritmo para pontuar documentos usando características verificáveis.

Por exemplo:

R(d)=0,35S+0,30D+0,20C+0,15AR(d)=0{,}35S+0{,}30D+0{,}20C+0{,}15AR(d)=0,35S+0,30D+0,20C+0,15A

Onde, em um exemplo de projeto:

- SSS: correspondência textual com os termos do ticket.
    
- DDD: proximidade nas dependências do código.
    
- CCC: relação com contratos e testes afetados.
    
- AAA: afinidade com o domínio explicitamente identificado.
    

Cada componente seria normalizado entre 0 e 1. Os pesos são ilustrativos, não calibrados.

Esse algoritmo pode ordenar centenas de documentos sem chamar uma IA.

Mas existe uma limitação: ele só utiliza sinais que conseguimos calcular.

Um documento pode ter baixa correspondência textual e ser importantíssimo para o desenvolvimento por conter uma exceção de negócio.

É aí que o JEV entra.

Não substituindo o algoritmo, mas avaliando as ambiguidades que sobraram após a seleção determinística.

Um cuidado: documentos obrigatórios nunca entram nessa competição por pontuação. Eles são incluídos por regra.

## 4. Quando o JEV realmente deve ser chamado?

Minha proposta é implementar um Decision Engine híbrido.

Ele terá três caminhos possíveis:

Decisão determinística

Existem regras suficientes, uma resposta verificável e nenhuma ambiguidade relevante. O código decide imediatamente, sem IA.

JEV

Existem opções válidas, mas é necessário interpretar significado, estimar relevância ou classificar uma situação. O JEV recebe um estado pequeno e escolhas delimitadas.

LLM maior ou revisão humana

Há conflito importante, baixa confiança, dependência não compreendida ou decisão que exige raciocínio aprofundado. O sistema não tenta resolver isso por simples classificação.

A documentação da TypeSafe recomenda justamente decompor decisões complexas em perguntas pequenas e combinar os resultados em código, incluindo mecanismos de roteamento baseados em confiança.

![](https://www.google.com/s2/favicons?domain=https://docs.typesafe.ai&sz=32)

TypeSafe AI

+1

Eu também colocaria um limite para as decisões probabilísticas: o motor pode selecionar um subconjunto de candidatos, mas antes de entregar o Context Pack um validador determinístico confere se todas as dependências obrigatórias foram incluídas.

### Um exemplo em TypeScript

A interface do nosso Decision Engine poderia começar assim:

```
type DecisionMode =
  | "DETERMINISTIC"
  | "JEV"
  | "ESCALATE";

interface ContextDecision {
  mode: DecisionMode;
  selectedIds: string[];
  requiredIds: string[];
  sourceRevision: string;
  confidence?: number;
  reasonCode: string;
}
```

Isso permite trabalhar com diferentes estratégias sem acoplar a fábrica à TypeSafe.

O `confidence` seria opcional e teria significado específico conforme o modelo e a pergunta. Não seria uma porcentagem genérica de garantia de acerto.

O código responsável pelo JEV só receberia candidatos permitidos, metadados, descrições curtas e trechos pertinentes. Não enviaria o repositório inteiro.

## 5. Que outras responsabilidades eu daria ao JEV?

Além da memória, existem oportunidades em praticamente todo o ciclo de desenvolvimento.

Eu as dividiria por prioridade.

|Responsabilidade|Papel proposto do JEV|Prioridade|
|---|---|---|
|Context Router|Classificar domínios e escolher caminhos ambíguos|Alta|
|Context Relevance Scorer|Pontuar documentos candidatos|Alta|
|Ticket Triage|Sugerir categoria, complexidade e tipo de trabalho|Alta|
|Agent Router|Auxiliar na escolha do provedor mais adequado entre elegíveis|Alta|
|Review Router|Sugerir profundidade e especialidade da revisão|Média|
|Handoff Advisor|Classificar a situação e sugerir estratégia de continuidade|Média|
|Memory Quality Advisor|Identificar possíveis duplicidades e inconsistências semânticas|Média|
|Incident Classifier|Classificar falhas e sugerir fluxos de diagnóstico|Futura|
|Priority Advisor|Sugerir prioridade técnica entre tickets elegíveis|Futura|

Algumas observações importantes:

Agent Router: disponibilidade, cotas observadas, autenticação, custo permitido e capacidades são filtros determinísticos. O JEV pode ajudar a escolher entre os provedores restantes, mas não deve habilitar gastos nem contornar limites.

Ticket Triage: eu manteria a classificação formal de risco R0–R4 na política da fábrica. O JEV pode sugerir a categoria, mas uma alteração identificada deterministicamente em autenticação ou pagamentos continua sujeita às restrições correspondentes.

Review Router: alterações cosméticas podem exigir verificações diferentes de alterações em concorrência, segurança ou persistência. O JEV pode sugerir uma revisão adicional, sem dispensar os checks obrigatórios.

Memory Quality Advisor: pode sinalizar que dois documentos parecem conflitantes. Não pode declarar sozinho qual regra deve substituir a outra.

E acrescentaria outra função interessante: o JEV como detector de incerteza operacional.

Se a fábrica estiver insistindo em uma implementação, recebendo falhas repetidas e alternando entre agentes sem progredir, o JEV poderia classificar o tipo de bloqueio e sugerir se vale investigar o contexto, revisar a especificação ou solicitar uma decisão humana.

Isso conversa muito bem com o objetivo de você acompanhar a fábrica como Tech Lead/CTO sem precisar supervisionar cada operação.

## 6. Uma preocupação: o JEV também tem custo

Aqui precisamos preservar uma decisão importante do nosso MVP.

O JEV da TypeSafe tem uma API oficial, disponível em `api.typesafe.ai/v1/systemone`, com perguntas estruturadas e autenticação própria.

![](https://www.google.com/s2/favicons?domain=https://api.typesafe.ai&sz=32)

Swagger UI

A TypeSafe anuncia preços baixos para tokens de entrada e ganhos expressivos em certos benchmarks. Entretanto, esses resultados são específicos dos experimentos apresentados pela empresa; não são uma garantia de economia no nosso sistema.

![](https://www.google.com/s2/favicons?domain=https://typesafe.ai&sz=32)

TypeSafe AI

+1

Não encontrei comprovação de que podemos baixar os pesos do JEV e executá-lo livremente na nossa VPS. Portanto, não o trataria como um modelo local nem como gratuito.

Nossa política atual mantém APIs pagas desativadas no MVP. Assim, eu incorporaria a arquitetura preparada para o JEV, mas deixaria a chamada real desabilitada até autorizarmos um experimento com orçamento controlado.

A alternativa inicial é desenvolver as mesmas interfaces usando exclusivamente algoritmos determinísticos. Podemos testar sua qualidade primeiro e identificar exatamente onde a inteligência adicional produz ganhos.

Também precisamos evitar um erro de interpretação: uma resposta tipada não significa que a escolha do modelo esteja correta. A distribuição de probabilidades e a confiança são sinais úteis, mas devem ser calibrados e avaliados com casos reais.

![](https://www.google.com/s2/favicons?domain=https://docs.typesafe.ai&sz=32)

TypeSafe AI

## 7. A evolução que considero ainda mais promissora

No médio prazo, podemos criar um seletor local treinado com as decisões históricas da fábrica.

Isso não significaria recriar o JEV nem copiar sua arquitetura proprietária.

Seria um classificador especializado em nossos projetos.

Pense no processo:

1. O Context Builder apresenta candidatos.
    
2. O algoritmo determinístico seleciona os documentos conhecidos.
    
3. Quando necessário e autorizado, o JEV auxilia nas escolhas ambíguas.
    
4. A fábrica registra quais documentos foram efetivamente utilizados e quais informações adicionais precisaram ser buscadas.
    
5. Depois do aceite da feature, esses registros podem alimentar um conjunto de treinamento validado.
    

Com um volume suficiente de exemplos, poderíamos experimentar um classificador leve — inicialmente até regressão logística, árvores de decisão ou outro algoritmo tradicional.

Ele aprenderia padrões de classificação e relevância com supervisão.

A execução poderia acontecer localmente, sem pagar uma chamada por decisão. E poderíamos comparar suas escolhas contra o sistema determinístico e o JEV antes de colocá-lo em produção.

É uma possibilidade interessante, mas não partiria diretamente para treinamento. Primeiro precisamos ter dados de boa qualidade, incluindo casos nos quais o sistema deixou de recuperar informações importantes.

## 8. Como eu organizaria o MVP dessa nova arquitetura

Eu estabeleceria quatro marcos de validação.

|Marco|Implementação|Como avaliar|
|---|---|---|
|M1|Busca e roteamento 100% determinísticos|Recuperação das regras obrigatórias e custo|
|M2|Context Packs e análise de dependências|Qualidade da seleção e redução de contexto|
|M3|JEV experimental sobre candidatos ambíguos|Ganho de relevância, latência e custo incremental|
|M4|Decisão híbrida automatizada|Features aceitas, retrabalho e regras omitidas|

O experimento do JEV deveria ocorrer inicialmente em modo de comparação, sem alterar as decisões executivas do sistema.

Podemos fornecer os mesmos tickets aos métodos determinístico e híbrido e verificar qual recuperou as fontes realmente necessárias. Só então decidir onde o JEV merece ser acionado automaticamente.

### Decisão arquitetural que eu adotaria

Manteria o Memory Engine e o Decision Engine como dois subsistemas distintos, mas fortemente integrados.

O Memory Engine conhece e recupera informações. O Decision Engine avalia quando é necessário utilizar inteligência para escolher entre caminhos possíveis.

Isso cria uma vantagem: o JEV não fica restrito ao Context Builder. Pode ajudar a fábrica inteira sem criar uma implementação diferente em cada módulo.

E permite evoluir de forma limpa:

`Deterministic Strategy → JEV Strategy → Future Local Classifier`

As estratégias compartilham contratos e métricas, mas cada uma tem suas capacidades, limitações e custos.

Minha principal recomendação é não construir uma árvore na qual cada nó depende de uma chamada ao JEV. Construiria um sistema em que o algoritmo determinístico resolve o máximo possível e o JEV atua como um especialista rápido nas bifurcações que realmente exigem julgamento.

Assim conseguimos combinar previsibilidade, memória persistente, decisões inteligentes e custos controlados — exatamente os atributos que queremos para a Fábrica de Software.

Para o MVP da nossa Fábrica de Software, eu escolheria utilizar um modelo pré-treinado pequeno, executado localmente, e preparar a arquitetura para treinar nosso próprio modelo de decisões conforme a fábrica acumular experiência.

Isso nos dá o melhor equilíbrio entre custo, aprendizado, simplicidade e evolução.

Mas faria algo ainda mais importante: desde o primeiro dia, construiria os mecanismos que permitirão à fábrica aprender com cada feature desenvolvida, mesmo antes de termos nosso primeiro modelo próprio treinado.

## 1. Qual das alternativas vale mais a pena?

|Abordagem|Vantagem|Minha decisão|
|---|---|---|
|Treinar uma rede neural do zero|Controle total e aprendizado profundo sobre IA|Não para o MVP|
|Ajustar um modelo pré-treinado (fine-tuning)|Especialização em tarefas particulares|Avaliar futuramente|
|Usar modelo pré-treinado local|Funciona antes de termos dados próprios|Adotar no MVP|
|Treinar classificador próprio pequeno|Aprende com os resultados da fábrica|Preparar no MVP, treinar depois|
|Regras determinísticas|Baratas, rápidas e auditáveis|Base obrigatória|

O primeiro modelo local não precisaria gerar texto, escrever código ou conversar.

Ele teria uma função muito mais específica: ajudar a fábrica a encontrar e selecionar o conhecimento necessário para desenvolver uma feature.

Por exemplo, diante de um ticket que pede uma melhoria no mecanismo de handoff, o modelo poderia identificar documentos sobre checkpoints, concorrência, persistência e troca de provedores.

Já o nosso futuro modelo próprio aprenderia quais desses documentos são realmente úteis em situações semelhantes, utilizando o histórico das implementações anteriores.

## 2. A arquitetura que construiria agora

Novo ticket de desenvolvimento

Objetivo, descrição e critérios de aceite

Motor determinístico

Regras obrigatórias, dependências, Git, contratos e filtros de segurança

Modelo pré-treinado

MVP

Similaridade semântica e recuperação de contexto

Modelo próprio

Futuro

Aprende a priorizar opções a partir das experiências

Context Builder + validador

Gera um Context Pack versionado com todas as regras obrigatórias

Claude / Codex / Antigravity

Implementação e verificação

Histórico de decisões e resultados

Dados persistentes para treinar versões futuras do classificador

A chave dessa arquitetura é permitir que o sistema funcione corretamente mesmo sem o modelo próprio.

Quando tivermos dados suficientes, adicionaremos o classificador treinado sem refazer o Context Builder, o grafo de conhecimento ou a integração com as três IAs.

## 3. Qual modelo utilizar no MVP?

Minha primeira candidata seria a família [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small).

É um modelo especializado em embeddings, com aproximadamente 118 milhões de parâmetros, que gera vetores de 384 dimensões e tem licença MIT. Ele foi projetado para tarefas de recuperação e similaridade textual.

![](https://www.google.com/s2/favicons?domain=https://leaderboard.mteb.org&sz=32)

MTEB Leaderboard

+1

Por que eu o escolheria?

- Consegue trabalhar com documentação em português e inglês.
    
- É muito menor que uma LLM generativa típica.
    
- Não exige GPU dedicada para executar inferência.
    
- Pode gerar embeddings antecipadamente, evitando reprocessar todo o conhecimento em cada ticket.
    
- Oferece uma base de características que nosso futuro classificador poderá utilizar.
    

Existe uma limitação importante: ele aceita textos de até 512 tokens, então documentos maiores precisam ser divididos em trechos. Também exige respeitar sua convenção de prefixos `query:` e `passage:` para recuperação.

![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)

intfloat/multilingual-e5-small at main

Usaria uma versão ONNX compatível com o nosso runtime e avaliaria quantização de 8 bits para reduzir memória e processamento. O Transformers.js permite inferência em Node.js e utilização de variantes quantizadas, conforme a disponibilidade do modelo escolhido.

![](https://www.google.com/s2/favicons?domain=https://huggingface.co&sz=32)

Hugging Face

+1

Ainda precisamos executar um benchmark na VPS para confirmar o consumo real e escolher a variante exata.

## 4. Como preparar o treinamento do nosso modelo próprio desde o início?

Aqui está o ponto mais importante da proposta.

A fábrica deve começar a registrar os exemplos necessários ao aprendizado antes de existir um modelo próprio treinado.

Imagine a seguinte situação:

Uma feature altera um mecanismo de recuperação. O Context Builder escolhe cinco documentos. Durante a implementação, o Codex descobre que precisava de uma sexta regra, relacionada à concorrência dos workers.

Esse é um exemplo valioso para o treinamento futuro.

Nossa fábrica precisaria registrar:

|Informação|Exemplo|
|---|---|
|Ticket|FAC-025|
|Documento candidato|`concorrencia-workers.md`|
|Similaridade semântica|0,67 — valor ilustrativo|
|Relação no grafo|Dois níveis de distância|
|Selecionado inicialmente?|Não|
|Relevante após análise?|Sim|
|Evidência|Contrato e teste relacionados|
|Revisão do código|SHA da implementação|

Depois de uma avaliação, esse caso poderá ser usado como exemplo de documento relevante que nosso mecanismo original não recuperou.

Com vários exemplos desse tipo, conseguiremos treinar o classificador.

### O que ele aprenderá matematicamente?

Suponha que temos cinco características:

- x1x_1x1​: similaridade semântica.
    
- x2x_2x2​: proximidade no grafo de dependências.
    
- x3x_3x3​: correspondência textual.
    
- x4x_4x4​: relação com arquivos modificados.
    
- x5x_5x5​: relação com testes afetados.
    

Uma regressão logística poderia aprender a combinar essas características:

P(relevante)=σ(w0+w1x1+w2x2+w3x3+w4x4+w5x5)P(\text{relevante}) = \sigma(w_0+w_1x_1+w_2x_2+w_3x_3+w_4x_4+w_5x_5)P(relevante)=σ(w0​+w1​x1​+w2​x2​+w3​x3​+w4​x4​+w5​x5​)

Os www são pesos aprendidos durante o treinamento. A função σ\sigmaσ transforma o resultado em um valor entre zero e um.

Isso já é um modelo de machine learning próprio.

Ele aprende quais sinais costumam indicar que determinado documento é relevante para uma feature.

E podemos construir esse tipo de classificador com ferramentas relativamente simples. O scikit-learn, por exemplo, suporta classificação multirrótulo e classificadores lineares, sem exigir redes neurais complexas.

![](https://www.google.com/s2/favicons?domain=https://scikit-learn.org&sz=32)

scikit-learn 1.9.1 documentation

As probabilidades não serão automaticamente confiáveis: precisaremos avaliá-las e, quando apropriado, calibrá-las com dados independentes.

![](https://www.google.com/s2/favicons?domain=https://scikit-learn.org&sz=32)

scikit-learn 1.9.1 documentation

## 5. Qual seria a estrutura técnica?

Manteria a arquitetura da fábrica em React + NestJS + worker Node, todos em TypeScript.

Separaria quatro responsabilidades:

|Componente|Responsabilidade|
|---|---|
|`ContextIndexer`|Indexar documentos, símbolos e dependências|
|`EmbeddingProvider`|Gerar vetores utilizando o modelo local|
|`ContextSelector`|Combinar regras obrigatórias, busca e ranking|
|`LearningPipeline`|Registrar exemplos, treinar e avaliar classificadores|

Criaria também uma interface neutra para seleção:

```
interface ContextRanker {
  rank(
    ticket: TicketContext,
    candidates: ContextCandidate[]
  ): Promise<RankedCandidate[]>;
}
```

Teríamos inicialmente duas implementações:

`DeterministicRanker` — utiliza regras e pesos configurados.

`LocalMLRanker` — utiliza nosso classificador treinado, quando estiver disponível.

Essa separação é bastante importante.

A implementação determinística permaneceria como baseline e mecanismo de recuperação. Se o modelo local falhar, a fábrica poderá utilizar as regras convencionais. Se não for possível garantir a presença das regras obrigatórias, a execução deverá ser bloqueada, não prosseguir com contexto incompleto.

Para o banco, começaria com PostgreSQL e adicionaria `pgvector` quando habilitarmos a busca semântica. Ele suporta busca exata e índices aproximados, incluindo HNSW, sem exigir outro servidor de banco.

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

O treinamento do classificador poderia ocorrer em um laboratório Python separado, com o modelo resultante exportado para inferência no worker TypeScript. Não precisaríamos transformar todo o backend em Python.

### Como preservar a possibilidade de evoluir?

Definiria desde o MVP registros versionados de:

- Modelo de embeddings utilizado e sua versão.
    
- Revisão do Git e da documentação.
    
- Context Packs e fontes selecionadas.
    
- Características utilizadas na classificação.
    
- Decisões tomadas por cada estratégia.
    
- Rótulos validados e evidências.
    
- Versões dos classificadores treinados e métricas.
    

É essencial lembrar que o modelo treinado não será a memória oficial do software.

As regras de negócio continuarão documentadas e versionadas. O modelo aprenderá a localizar e priorizar informações. Assim, poderemos substituí-lo sem perder o conhecimento acumulado.

Também precisamos considerar que trocar o modelo de embeddings pode exigir gerar novamente os vetores do índice. Por isso, embeddings e configurações devem ter versões explícitas.

## 6. Plano de implementação que adotaria

Evolução do MVP

Recomendado

Marco 1 — Motor determinístico

Implementar indexação, relações e seleção inicial. Criar o contrato do `ContextRanker` e começar a armazenar decisões e evidências.

Entregável: Context Builder funcional sem ML.

Marco 2 — Primeiro modelo pré-treinado local

Integrar embeddings, avaliar desempenho na VPS e comparar recuperação semântica com a determinística.

Entregável: busca híbrida e Context Packs versionados.

Marco 3 — Base de treinamento

Registrar exemplos reais e preparar um conjunto rotulado de relevância. Incluir casos que o sistema recuperou corretamente e casos que deixou passar.

Entregável: dataset versionado e metodologia de avaliação.

Marco 4 — Primeiro modelo próprio

Treinar um classificador simples e executar comparações em modo sombra, sem deixar suas decisões afetarem as execuções reais.

Entregável: classificador avaliado contra o baseline.

Marco 5 — Aprendizado operacional

Promover o modelo se houver evidências de melhoria, monitorar resultados e permitir rollback.

Entregável: evolução controlada do sistema de seleção.

Não anteciparia o marco 4 apenas para dizermos que temos uma IA própria. O piloto da fábrica prevê dez tickets iniciais, e isso provavelmente não será suficiente, por si só, para treinar um classificador robusto.

Podemos produzir exemplos rotulados manualmente e utilizar casos de teste para começar a experimentar, mas os dados de avaliação devem permanecer separados dos dados de treinamento.

## 7. Como saberemos quando chegou a hora de utilizar o modelo próprio?

Eu acompanharia quatro indicadores desde o primeiro ticket.

|Indicador|O que queremos descobrir|
|---|---|
|Recall das regras críticas|O sistema recupera todas as informações obrigatórias conhecidas?|
|Precisão da recuperação|Quanto conteúdo irrelevante está sendo enviado?|
|Custo operacional|Quanto tempo, CPU e contexto são consumidos?|
|Qualidade da entrega|A seleção provoca omissões, regressões ou retrabalho?|

A versão aprendida só substituiria o ranking determinístico quando demonstrasse benefício em um conjunto de avaliação representativo, sem reduzir a cobertura de requisitos críticos.

Não precisamos definir antecipadamente que o modelo deve economizar 70%, 80% ou 90% dos tokens. Precisamos descobrir, com experimentos, qual economia é possível sem prejudicar a qualidade.

## 8. E o aprendizado que você quer adquirir?

Essa escolha também é excelente para sua formação.

Ao construir o MVP, você aprenderá primeiro como funciona a busca determinística e o cálculo de similaridade. Depois entenderá embeddings, vetores, classificação e regressão logística.

Quando chegar o momento de treinar o modelo próprio, você já terá familiaridade com os dados que ele utilizará.

E poderemos fazer um experimento particularmente didático: implementar uma pequena regressão logística do zero, entender seus cálculos e depois comparar com a implementação profissional do scikit-learn.

Isso ensina os fundamentos sem comprometer a confiabilidade da fábrica.

## A decisão que eu registraria na arquitetura

ADR proposta — Inteligência Local Progressiva

A Fábrica de Software utilizará mecanismos determinísticos como base de seleção e validação de contexto, combinados com um modelo de embeddings local pré-treinado.

Desde o MVP, registrará dados versionados de decisões e resultados, preparando o treinamento futuro de um classificador supervisionado próprio.

Modelos aprendidos serão componentes substituíveis, não fontes oficiais de regras de negócio. Nenhuma decisão probabilística poderá suprimir requisitos obrigatórios, contornar controles de segurança ou autorizar gastos.

A inferência local será executada na VPS com limites de recursos. APIs pagas e JEV permanecerão opcionais e desabilitados por padrão.

Minha escolha final seria: não criar uma LLM própria agora, mas começar imediatamente a construir a infraestrutura que permitirá à fábrica aprender.

Assim entregamos um MVP viável, preservamos nossa arquitetura TypeScript, evitamos custos desnecessários e deixamos o projeto preparado para desenvolver uma inteligência própria cada vez mais especializada.

Eu incorporaria essa decisão ao FAC-006 — Context Builder, mas separaria o treinamento do primeiro classificador em um novo ticket de evolução, evitando ampliar demais o escopo e atrasar o MVP.

Imagem carregada

Perfeito só encaixe o JEV para o que o modelo determinístico nao conseguir decidir nessa arquitetura: E pensando em tudo o que discutimos, vamos criar uma lista muito completa com tudo o que pode acontecer nesse fluxo de desenvolvimento desde a criação de um ticket com o agente tech lead até a conclusão. Uma lista muito mapeada com todo o caminho percorrido e vamos colocar nesta lista o que será utilizado: LLm, modelo local, fator deterministico, JEV ou outra coisa. Quero um mapeamento mais que completo

# Le Fabrique — Arquitetura completa do fluxo autônomo de desenvolvimento

Do ticket criado pelo Tech Lead até a entrega, com motor determinístico, IA local, JEV e LLMs especializadas.

Eu transformaria nossa discussão em uma especificação central da Fábrica de Software: um mapeamento de todas as decisões, ações, verificações, exceções e mecanismos de recuperação que podem ocorrer durante o desenvolvimento.

A proposta é fazer a fábrica utilizar a menor inteligência necessária para resolver cada problema, preservando segurança, contexto e qualidade.

Antes do mapeamento, precisamos ajustar um ponto fundamental: o JEV não deve simplesmente substituir o motor determinístico quando uma operação falhar. Ele entra quando há uma decisão semântica ambígua entre alternativas válidas. Se o problema é uma regra de segurança, uma autorização ausente ou uma falha de infraestrutura, o sistema deve aplicar procedimentos verificáveis, bloquear ou escalar — não pedir ao JEV para adivinhar.

## 1. A arquitetura revisada com o JEV

Novo ticket de desenvolvimento

Agente Tech Lead · requisitos · critérios de aceite

Motor determinístico

Políticas, regras, relações conhecidas, Git, contratos, limites e segurança

Quando restarem escolhas semânticas

Modelo local

MVP

Embeddings, similaridade, classificação e ranking

JEV

Opcional · autorizado

Choice, Score e Noul para decisões ainda ambíguas

Baixa confiança, conflito ou decisão complexa

Decision Engine + validador

Combina sugestões, aplica políticas e decide se precisa escalar

Context Builder

Context Pack versionado, fontes e regras obrigatórias

Claude / Codex / Antigravity

Planejamento profundo, implementação, revisão e QA

Memória compartilhada e histórico

Decisões, evidências, resultados e exemplos de treinamento

Essa arquitetura não é uma sequência obrigatória de chamadas. O mecanismo determinístico pode resolver uma decisão diretamente; a IA local e o JEV são acionados somente quando acrescentam valor. O Decision Engine valida todas as escolhas antes de transformá-las em ações.

O JEV é adequado para perguntas estruturadas: `Choice` seleciona uma alternativa, `Score` atribui pontuação segundo critérios e `Noul` avalia uma condição sim/não probabilística. A própria documentação da TypeSafe recomenda perguntas pequenas e específicas, combinadas posteriormente por lógica convencional.

![](https://www.google.com/s2/favicons?domain=https://docs.typesafe.ai&sz=32)

TypeSafe AI

### As seis responsabilidades tecnológicas

|Sigla|Mecanismo|Função|
|---|---|---|
|D|Determinístico|Executar regras, algoritmos, verificações e transições controladas|
|ML|Modelo local|Recuperação semântica, classificação e ranking|
|J|JEV|Julgar alternativas semânticas delimitadas|
|LLM|Claude/Codex/Antigravity|Analisar, projetar, programar, investigar e revisar|
|H|Humano|Aprovar decisões, resolver ambiguidades críticas e autorizar riscos|
|S|Sistema/ferramentas|Git, PostgreSQL, compilador, testes, CI, container, monitoramento etc.|

Quando indicarmos `D → ML → J → LLM`, significa uma política possível de escalonamento, não quatro chamadas necessárias.

### Regras que nenhum modelo poderá ultrapassar

- JEV e ML não aprovam despesas, deploy, migrações irreversíveis ou permissões.
    
- Uma decisão probabilística nunca remove regras obrigatórias do Context Pack.
    
- Resultados de testes, compilação, Git e estado dos processos precisam de evidência verificável.
    
- A falta de JEV ou o esgotamento de uma cota não autoriza fallback pago.
    
- LLMs podem propor decisões arquiteturais, mas mudanças estruturais precisam seguir a política de aprovação.
    
- Um agente não pode alterar a memória oficial apenas afirmando que aprendeu uma nova regra.
    

Restrição do MVP: conforme a política v2.1, APIs e créditos extras permanecem desativados. Portanto, a estratégia JEV será implementada como integração opcional, desligada inicialmente. O serviço oficial utiliza API e não deve ser confundido com um modelo executado na nossa VPS.

![](https://www.google.com/s2/favicons?domain=https://docs.typesafe.ai&sz=32)

TypeSafe AI

## 2. Macrofluxo de uma feature: do início ao fim

Pipeline completo proposto

01

Tech Lead recebe e qualifica o ticket

LLM + D + ML/J eventual

02

Descoberta de regras e dependências

D + ML + J

03

Análise de risco e planejamento

D + LLM + H

04

Seleção do provedor e orçamento

D + ML/J eventual

05

Preparação do contexto e ambiente

D + S + ML

06

Desenvolvimento incremental

LLM + S

07

Testes e validações

S + D

08

Revisão independente

LLM + D + S

09

Correções e recuperação

D + LLM + ML/J eventual

10

Documentação e atualização da memória

LLM + D + S

11

Aceite humano e integração autorizada

H + D + S

12

Métricas, aprendizado e encerramento

D + S + ML futuro

Esse é o caminho principal. Na prática, qualquer fase pode resultar em uma pausa controlada, necessidade de esclarecimento, repetição limitada, troca de agente ou bloqueio de segurança.

Agora vamos detalhar o que realmente acontece dentro de cada fase.

## 3. Mapeamento detalhado das operações

### Fase 01 — Abertura e qualificação do ticket

Estado inicial: DRAFT · Responsável: Agente Tech Lead

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|001|Receber uma solicitação de feature, bug, melhoria, refatoração ou incidente|S|
|002|Identificar usuário, projeto e permissões para criar o ticket|D|
|003|Verificar se o projeto está ativo e se o repositório está cadastrado|D|
|004|Interpretar a solicitação em linguagem natural|LLM — Tech Lead|
|005|Classificar o tipo de trabalho usando categorias conhecidas|D → ML → J|
|006|Procurar tickets semelhantes, duplicados ou relacionados|D + ML; J para ambiguidade|
|007|Identificar quais informações de requisito estão faltando|LLM + D|
|008|Classificar se a solicitação é ambígua ou potencialmente incompleta|D → ML/J|
|009|Solicitar esclarecimentos quando a dúvida muda o comportamento esperado|LLM → H|
|010|Transformar a solicitação em descrição técnica inicial|LLM — Tech Lead|
|011|Propor critérios de aceite verificáveis|LLM + D|
|012|Persistir ticket, versão, autor, requisitos, dúvidas e estado inicial|D + S|

Decisões especiais desta fase: se a solicitação for duplicada, o sistema sugere vinculação ou consolidação; se não houver informações suficientes, permanece DRAFT; se houver conflito explícito com uma política, sinaliza o conflito e não o resolve por probabilidade.

O JEV aqui teria um papel interessante: classificar intenção e avaliar se uma descrição aparentemente pequena se refere a uma correção, refatoração ou mudança funcional. Mas não deve decidir sozinho requisitos que o solicitante não definiu.

### Fase 02 — Descoberta de contexto e análise de impacto

Responsáveis: Tech Lead + Memory Engine

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|013|Identificar a revisão de referência do projeto|D + Git|
|014|Consultar arquitetura, ADRs e políticas obrigatórias|D + S|
|015|Recuperar as regras de negócio diretamente relacionadas|D + ML|
|016|Identificar os domínios candidatos da alteração|D → ML → J|
|017|Encontrar classes, métodos, arquivos e módulos associados|D + análise estática|
|018|Consultar dependências diretas no grafo|D|
|019|Expandir dependências indiretas relevantes|D + ML; J para priorização|
|020|Localizar contratos de APIs, banco, eventos e filas|D + S|
|021|Identificar testes existentes e critérios associados|D + S|
|022|Procurar decisões históricas e implementações semelhantes|D + ML|
|023|Avaliar documentos candidatos semanticamente ambíguos|ML → J|
|024|Identificar relações não mapeadas, inconsistências e informações ausentes|D + LLM quando necessário|

Aqui fica uma das principais aplicações do JEV.

Imagine que o grafo encontre 40 documentos relacionados. O algoritmo determinístico identifica 8 obrigatórios e o modelo local apresenta 12 candidatos adicionais.

O JEV pode avaliar esses 12 candidatos com `Score` ou perguntas `Noul`, ajudando a decidir quais devem receber investigação adicional.

Não precisamos perguntar ao JEV sobre os 40 documentos em chamadas individuais. Podemos pré-filtrar, compactar informações e avaliar lotes de perguntas relacionadas, dentro dos limites do serviço.

No fim dessa fase, o Tech Lead deverá conhecer a área provável de impacto e reconhecer explicitamente o que ainda não foi possível determinar.

### Fase 03 — Análise de risco, viabilidade e planejamento

Responsáveis: Tech Lead + Arquiteto

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|025|Identificar componentes de segurança, autenticação e autorização afetados|D|
|026|Detectar possibilidade de migração destrutiva ou alteração irreversível|D + LLM|
|027|Aplicar classificação mínima obrigatória de risco|D|
|028|Sugerir risco adicional considerando a descrição e os efeitos indiretos|ML/J → LLM|
|029|Verificar se o risco é permitido pela política de automação|D|
|030|Identificar incompatibilidades técnicas e arquiteturais|D + LLM|
|031|Determinar se a feature exige nova decisão arquitetural|LLM — Arquiteto|
|032|Comparar alternativas e trade-offs de implementação|LLM|
|033|Identificar dependências entre tickets e bloqueios anteriores|D + S|
|034|Decompor feature em etapas ou subtarefas implementáveis|LLM — Tech Lead|
|035|Estimar esforço, complexidade e necessidades de teste|D + histórico; ML/J consultivo|
|036|Definir plano técnico, critérios de aceite e pedidos de aprovação|LLM + D + H quando exigido|

Atribuição importante: o JEV pode pontuar risco percebido, complexidade ou similaridade com incidentes anteriores, mas a classificação de risco definitiva respeita limites mínimos impostos pelas políticas.

Uma alteração em controle de autenticação não pode se tornar R0 só porque um modelo atribuiu baixa complexidade.

Para o piloto, manteríamos alterações pequenas e de baixo risco, conforme o contrato atual.

PILOTO.md

### Fase 04 — Preparação e autorização para execução

Transição pretendida: DRAFT → READY → WAITING_WORKER

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|037|Validar campos e critérios mínimos do ticket|D|
|038|Conferir dependências e bloqueios de outros tickets|D|
|039|Verificar compatibilidade do ticket com a política de risco|D|
|040|Conferir disponibilidade de worker e recursos da VPS|D + monitoramento|
|041|Verificar autenticação e capacidades comprovadas dos provedores|D + S|
|042|Excluir provedores indisponíveis, inelegíveis ou com cobrança não autorizada|D|
|043|Escolher entre provedores elegíveis com base em histórico e tipo de tarefa|D → ML/J|
|044|Determinar limite de duração, tentativas, correções e handoffs|D|
|045|Registrar a estratégia escolhida e as razões da decisão|D + S|
|046|Realizar transição de estado com controle de concorrência e persistência|D + PostgreSQL|

O Provider Router não deve perguntar ao JEV se pode usar uma conta sem autorização, pagar por créditos extras ou ignorar uma cota.

Primeiro os filtros determinísticos eliminam opções inválidas. Só depois o JEV pode sugerir qual das alternativas restantes parece mais apropriada.

Se nenhum provedor estiver disponível, o ticket não falha necessariamente: permanece aguardando, sem tentar desbloquear gastos automaticamente.

### Fase 05 — Construção do Context Pack

Responsáveis: Memory Engine + Context Builder

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|047|Carregar a política global vigente|D|
|048|Carregar instruções específicas do projeto e do domínio|D|
|049|Identificar a versão exata do código e da documentação|D + Git|
|050|Obter regras e contratos obrigatórios|D|
|051|Recuperar trechos de código relacionados à tarefa|D + análise estática|
|052|Buscar documentação por palavras-chave e identificadores|D|
|053|Buscar documentos semanticamente relacionados|ML local|
|054|Expandir relações do grafo dentro dos limites definidos|D|
|055|Ranquear documentos adicionais não obrigatórios|D + ML|
|056|Resolver empate ou ambiguidade semântica entre candidatos|J, se habilitado|
|057|Identificar contexto insuficiente, conflitante ou desatualizado|D + LLM quando necessário|
|058|Construir Context Pack com orçamento adaptativo e referências|D + S|
|059|Validar fontes, versões, cobertura obrigatória, omissões e segredos|D + S|

O resultado dessa fase é um artefato versionado, não simplesmente um prompt.

Ele informa de onde veio cada regra, por que foi incluída, a qual revisão pertence e quais informações foram omitidas.

Se o Context Builder não conseguir garantir uma informação crítica, ele não deve fingir que o pacote está completo. Precisa solicitar expansão, reindexar a fonte ou bloquear a execução até haver uma solução adequada.

### Fase 06 — Preparação do ambiente de desenvolvimento

Responsáveis: Worker + Runtime Gateway

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|060|Reservar worker disponível por lease|D + PostgreSQL|
|061|Garantir exclusividade de escrita no workspace|D|
|062|Verificar se processos de uma execução anterior foram encerrados|D + sistema operacional|
|063|Criar branch/worktree isolada|Git + D|
|064|Verificar branch e SHA de referência|Git + D|
|065|Identificar alterações preexistentes e arquivos não rastreados|Git + D|
|066|Preparar sandbox, permissões e limites de recursos|Docker/OS + D|
|067|Bloquear acesso ao host, segredos e serviços não autorizados|D + controles do ambiente|
|068|Verificar dependências e ferramentas exigidas pelo projeto|D + S|
|069|Executar verificações iniciais para registrar o baseline|S|
|070|Identificar falhas já existentes antes da feature|D + resultados de testes|
|071|Preparar cliente oficial de IA selecionado|Runtime Gateway + D|
|072|Confirmar modo de autenticação e condições de uso|D + preflight|
|073|Registrar snapshot/checkpoint inicial recuperável|D + Git + armazenamento|

Essa fase deve ser quase totalmente determinística.

Não faz sentido gastar inferência do JEV para conferir se uma branch existe, se um processo está vivo ou se há espaço em disco.

Também considero fundamental que a IA encarregada de implementar o ticket não tenha capacidade de modificar os mecanismos que garantem seu próprio isolamento.

### Fase 07 — Desenvolvimento incremental da feature

Estado: RUNNING · Responsável: Agente Developer

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|074|Receber objetivo, critérios, restrições e Context Pack|D + LLM|
|075|Confirmar arquivos e componentes que precisam ser estudados|D + ML|
|076|Solicitar contexto adicional durante a implementação|LLM → Memory Engine|
|077|Selecionar documentos adicionais para expansão de contexto|D → ML → J|
|078|Interpretar regras de negócio e contratos existentes|LLM|
|079|Formular plano de alteração limitado ao ticket|LLM — Developer|
|080|Verificar se o plano ultrapassa o escopo autorizado|D + LLM reviewer|
|081|Editar código incrementalmente|LLM + ferramentas|
|082|Adicionar ou atualizar testes relacionados às mudanças|LLM|
|083|Verificar se houve alteração em interfaces públicas ou contratos|D + ferramentas|
|084|Detectar dependências novas e necessidade de ampliar contexto|D + ML; LLM quando necessário|
|085|Executar verificações locais rápidas e interpretar falhas|S + D + LLM|
|086|Registrar progresso, alterações e checkpoint intermediário|D + S|

Nessa fase, a LLM é essencial. O JEV não substituirá o Developer na programação.

Mas repare nas operações 076, 077 e 084: elas podem acontecer várias vezes durante uma feature complexa.

É aí que o JEV e os modelos locais podem produzir economias significativas. Quando o Developer pedir uma informação específica, o sistema poderá recuperá-la sem reenviar todo o histórico da execução.

Por exemplo, o Codex pode solicitar: Preciso entender o mecanismo que invalida um lease após uma falha do worker.

O Memory Engine primeiro procura as relações formais. Se houver vários documentos igualmente prováveis e uma escolha semântica delimitada, o JEV pode ajudar a selecionar qual examinar primeiro.

Não precisamos consultar o Claude para resolver essa escolha, a menos que a documentação seja contraditória ou a questão realmente exija raciocínio aprofundado.

### Fase 08 — Testes, validações e análise de qualidade

Estado: VALIDATING · Responsáveis: Worker + verificações automatizadas

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|087|Detectar quais arquivos e pacotes foram alterados|Git + D|
|088|Selecionar testes obrigatórios conforme o impacto conhecido|D|
|089|Identificar testes candidatos adicionais|D + ML; J eventual|
|090|Executar lint e formatadores em modo apropriado|S|
|091|Executar verificação de tipos TypeScript|S|
|092|Executar testes unitários relacionados|S|
|093|Executar testes de integração necessários|S|
|094|Executar testes de contrato de APIs/eventos, se afetados|S|
|095|Executar build e verificar artefatos produzidos|S|
|096|Executar verificações de segurança configuradas|S + D|
|097|Comparar falhas com o baseline e distinguir regressões|D + S; LLM em diagnósticos ambíguos|
|098|Consolidar resultados associados ao SHA do código|D + S|

Aqui a distribuição é praticamente inversa à fase de desenvolvimento.

O Developer é uma LLM, mas quem determina se um teste passou é a ferramenta real que executou o teste.

O modelo local ou o JEV podem sugerir testes adicionais, mas não podem dispensar testes exigidos pelas políticas.

Se os testes falharem, a execução retorna ao fluxo de correção com diagnóstico e limites de tentativas.

### Fase 09 — Revisão independente e ciclo de correções

Estado: REVIEW · Responsável: Reviewer separado do Developer

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|099|Confirmar que o Developer não está mais escrevendo durante a revisão|D + S|
|100|Capturar diff, revisão exata e arquivos afetados|Git + D|
|101|Construir contexto específico de revisão|D + ML|
|102|Identificar especialidade necessária para revisão|D → ML → J|
|103|Selecionar provedor elegível para revisão|D → ML/J|
|104|Verificar aderência aos critérios de aceite|LLM Reviewer + evidências|
|105|Analisar possíveis falhas de negócio e arquitetura|LLM Reviewer|
|106|Examinar segurança, concorrência, tratamento de erros e regressões|LLM + ferramentas|
|107|Identificar problemas concretos com referências a arquivos e critérios|LLM Reviewer|
|108|Classificar achados segundo regras de severidade|D + LLM; ML/J consultivo|
|109|Autorizar correção limitada ou bloquear por problema crítico|D|
|110|Reexecutar validações e revisão após correções|S + D + LLM|

A revisão terá independência lógica e operacional: o Reviewer não deverá alterar o código enquanto avalia a revisão apresentada.

Se encontrar um problema, registra o achado e o devolve para uma nova tentativa do Developer.

O MVP já prevê um limite inicial de duas rodadas de correção. Quando o limite for atingido, o sistema deve preservar o estado e produzir um diagnóstico, em vez de entrar em um ciclo infinito.

ESPEC-MVP.md

### Fase 10 — Documentação e atualização da memória

Estado: DOCS · Responsáveis: Agente de documentação + Memory Engine

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|111|Identificar exatamente quais componentes foram modificados|Git + D|
|112|Identificar domínios e contratos afetados|D + ML|
|113|Gerar relatório de entrega com base nas alterações e evidências|LLM — Documentação|
|114|Atualizar documentação vigente dos domínios|LLM + D|
|115|Atualizar instruções de funcionamento e exemplos relevantes|LLM|
|116|Propor alterações em ADRs quando decisões arquiteturais mudaram|LLM + H se exigido|
|117|Identificar conhecimentos novos e aprendizados reaproveitáveis|ML/J consultivo + LLM|
|118|Propor inclusão, alteração ou invalidação de regras da memória|LLM + D|
|119|Conferir conflitos com versões e decisões anteriores|D + ML; LLM quando necessário|
|120|Atualizar índices, changelog, backlog e lessons aplicáveis|D + LLM|
|121|Validar estrutura, links, fontes, referências e evidências|D + S|
|122|Produzir versão candidata da memória, sem publicá-la como vigente antes do aceite|D + S|

Esta fase é particularmente importante para nosso projeto.

Lembra que você estabeleceu que toda feature precisa gerar uma documentação de entrega? Essa política já faz parte do planejamento. Também são exigidos README vigente, índice, changelog e lessons pertinentes.

POLITICA-IA.md

Eu acrescentaria um Memory Update Gate.

A IA poderia propor que determinada implementação introduziu uma nova regra de negócio. O gate verificaria as evidências e a aprovação correspondente antes de registrar essa regra como vigente.

O JEV pode ajudar a classificar se determinada anotação parece uma regra, decisão ou observação operacional. Mas não terá autoridade para afirmar que o negócio mudou.

### Fase 11 — Aceite, integração e autorização

Estados: AWAITING_HUMAN → DONE, mediante condições

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|123|Verificar que a revisão final tem todos os artefatos exigidos|D|
|124|Conferir resultados de testes e validações da revisão exata|D + S|
|125|Confirmar revisão concluída e achados resolvidos ou explicitamente aceitos|D + H quando aplicável|
|126|Validar documentação e propostas de atualização de memória|D + LLM|
|127|Preparar resumo executivo da implementação|LLM|
|128|Apresentar mudanças, riscos, evidências e limitações|React + S|
|129|Solicitar aceite humano associado ao SHA exato|H + D|
|130|Detectar alteração posterior ao aceite e invalidar aprovação obsoleta|D|
|131|Executar merge ou deploy somente quando houver autorização específica|H + D + Git/CI|
|132|Publicar memória vigente após incorporação aprovada, preservando histórico|D + S|
|133|Registrar estado final, decisão e trilha de auditoria|D + PostgreSQL|

No MVP, DONE não significa deploy automático.

Uma feature pode estar aceita e concluída na fábrica sem ter sido implantada em produção.

Também separaria as permissões de aprovar código, fazer merge e autorizar deploy. São ações diferentes, com riscos diferentes.

O aceite humano continua obrigatório no MVP. Mais tarde podemos discutir políticas de autonomia limitada para alterações de baixíssimo risco, mas não habilitaria isso agora.

### Fase 12 — Encerramento, métricas e aprendizado

Responsáveis: Orquestrador, métricas e Learning Pipeline

|ID|Ação ou decisão|Tecnologia|
|---|---|---|
|134|Consolidar duração e tentativas de execução|D + S|
|135|Consolidar provedores e modelos efetivamente utilizados|D + S|
|136|Registrar uso observado, desconhecido e custos atribuídos|D + S|
|137|Calcular quantidade de handoffs e interrupções|D|
|138|Medir quantidade de correções e retrabalho|D|
|139|Medir contexto inicial, expansões e recuperação de documentos|D + S|
|140|Identificar decisões que exigiram JEV ou escalonamento|D|
|141|Associar decisões ao resultado validado da feature|D + H/revisão quando necessário|
|142|Criar candidatos a exemplos de treinamento sem segredos|D + S|
|143|Identificar exemplos que precisam de rotulagem e verificação|ML/J consultivo; H/LLM na validação|
|144|Atualizar métricas de qualidade da seleção e das estratégias|D + S|
|145|Encerrar execução, aplicar retenção de artefatos e liberar recursos|D + S|

Esse ciclo fecha a arquitetura de aprendizado progressivo.

A fábrica passa a acumular informações sobre quais decisões funcionaram, quais documentos foram insuficientes, quais provedores tiveram melhor desempenho e quais tarefas exigiram mais retrabalho.

No futuro, nosso classificador local poderá aprender com esses exemplos.

Entretanto, dados históricos precisam ser tratados com cuidado. Uma decisão tomada pelo Codex não é automaticamente correta; o fato de um documento ter sido lido não significa que era necessário; e um ticket concluído não prova isoladamente que todas as escolhas intermediárias foram ideais.

Por isso, os exemplos utilizados no treinamento deverão ter rótulos e evidências confiáveis.

## 4. O que pode dar errado? Mapa de exceções e caminhos alternativos

O fluxo principal possui 145 operações propostas. Porém, para uma fábrica autônoma, o tratamento das exceções é tão importante quanto o desenvolvimento normal.

Uma fábrica confiável não é aquela que nunca falha. É aquela que reconhece falhas, preserva o que foi realizado e sabe quando continuar, trocar de estratégia ou parar.

### A. Problemas no ticket e nos requisitos

|Evento|Detecção|Resposta|
|---|---|---|
|X01. Ticket incompleto|D + LLM|Voltar a DRAFT e solicitar informações|
|X02. Critério de aceite impossível de verificar|LLM + D|Pedir reformulação|
|X03. Ticket duplicado|D + ML/J|Sugerir vínculo ou consolidação|
|X04. Requisitos contraditórios|D + LLM|Bloquear planejamento e solicitar decisão|
|X05. Feature grande demais|D + LLM|Propor decomposição|
|X06. Dependência entre tickets não concluída|D|Manter bloqueado|
|X07. Mudança fora do escopo do projeto|D + LLM|Rejeitar ou solicitar novo escopo|
|X08. Regra de negócio não encontrada|D + ML/J|Expandir busca; se necessário, pedir esclarecimento|
|X09. Solução incompatível com ADR vigente|D + LLM|Exigir análise de mudança arquitetural|
|X10. Risco superior ao permitido|D|Exigir aprovação ou impedir execução|

### B. Problemas na memória e no contexto

|Evento|Detecção|Resposta|
|---|---|---|
|X11. Documento desatualizado|Hash, versão e Git — D|Reindexar ou invalidar|
|X12. Dois documentos contraditórios|D + ML/LLM|Sinalizar conflito; não escolher verdade por votação|
|X13. Dependência indireta desconhecida|D + ML/J|Investigar código e contratos|
|X14. Embedding não encontrado|D|Buscar por índice textual|
|X15. Modelo local indisponível|D|Utilizar baseline determinístico|
|X16. Confiança insuficiente do ranking|D + ML|JEV autorizado ou LLM|
|X17. JEV indisponível|D|Fallback autorizado ou pausa|
|X18. Context Pack excede o limite|D|Priorizar opcionais; dividir a tarefa se necessário|
|X19. Regra obrigatória não cabe no contexto|D|Não truncar silenciosamente; decompor ou bloquear|
|X20. Documento contém segredos ou dados restritos|D + verificações|Redigir/excluir ou bloquear envio|
|X21. Memória de outra branch mistura estados|D + Git|Isolar pela revisão e sobreposição da branch|
|X22. Modelo sugere regra inexistente|D + validação de fontes|Rejeitar a sugestão não fundamentada|

### C. Infraestrutura, worker e provedores

|Evento|Detecção|Resposta|
|---|---|---|
|X23. VPS com memória insuficiente|Monitoramento — D|Pausar ou adiar novos jobs|
|X24. Disco quase cheio|Monitoramento — D|Bloquear novas execuções até recuperação segura|
|X25. Worker desconectado|Heartbeat/lease — D|Interromper e preservar estado|
|X26. Processo anterior não terminou|OS + D|Impedir novo writer|
|X27. Credencial expirada|Preflight — D|AUTH_REQUIRED|
|X28. Cota do provedor esgotada|Adapter + D|WAITING_PROVIDER ou handoff|
|X29. Modelo contratado indisponível|Preflight — D|Selecionar outro elegível|
|X30. Cliente oficial muda comportamento/versão|D + testes de compatibilidade|Bloquear adapter até validação|
|X31. Execução ultrapassa timeout|Supervisor — D|Encerrar árvore de processos e checkpoint|
|X32. Handoff falha parcialmente|D + Git + S|BLOCKED_RECOVERY até verificar integridade|
|X33. Executor tenta acessar segredo|Controles do sandbox|Bloquear acesso e registrar incidente|
|X34. Duas execuções disputam workspace|Lock + fencing token|Somente execução autorizada mantém escrita|

### D. Desenvolvimento e qualidade

|Evento|Detecção|Resposta|
|---|---|---|
|X35. Build falha|Compilador — S|Diagnóstico e correção limitada|
|X36. Teste falha|Test runner — S|Comparar com baseline|
|X37. Dependência nova é necessária|Git/package diff + LLM|Verificar política e autorização|
|X38. Developer modifica arquivos proibidos|Diff + D|Bloquear alteração e exigir recuperação segura|
|X39. Developer amplia escopo|D + Reviewer|Reverter/desmembrar alterações com segurança|
|X40. Falha de segurança detectada|Scanner + revisão|Bloquear aceite|
|X41. Reviewer discorda da implementação|LLM + evidências|Gerar achado concreto, sem loop ilimitado|
|X42. Duas correções não resolvem|Contador — D|PAUSED_LIMIT + diagnóstico|
|X43. Evidência não corresponde ao SHA|D + Git|Invalidar evidência e reexecutar verificação|
|X44. Teste E2E não pode ser executado|S + D|Marcar NÃO VERIFICADO e solicitar decisão|
|X45. Ambiente de teste contaminado por dados reais|D + verificações|Bloquear execução e tratar incidente|
|X46. Saída da LLM viola formato ou contrato|Validador — D|Rejeitar/repetir de forma limitada|

### E. Documentação, aprovação e encerramento

|Evento|Detecção|Resposta|
|---|---|---|
|X47. Relatório de entrega ausente|Document Gate — D|Impedir DONE|
|X48. README do domínio desatualizado|D + revisão semântica|Devolver para documentação|
|X49. Documento inventa teste não executado|Evidências + D/LLM|Rejeitar informação|
|X50. Nova decisão conflita com ADR|D + LLM|Exigir avaliação e aceite|
|X51. Humano rejeita implementação|H|Retornar ao planejamento ou correção|
|X52. Alteração depois do aceite|Git + D|Invalidar aceite anterior|
|X53. Merge apresenta conflitos|Git + D|Resolver em execução autorizada e revalidar|
|X54. Deploy autorizado apresenta falha|CI/monitoramento|Executar rollback aprovado ou recuperação|
|X55. Backup não restaura corretamente|Teste de recuperação|Bloquear operação dependente desse backup|
|X56. Exemplo de treinamento apresenta rótulo duvidoso|Validação de dataset|Não promovê-lo ao conjunto confiável|

Para cada exceção, o sistema deverá registrar o motivo, a revisão afetada, a evidência, a decisão tomada, as tentativas anteriores e a próxima ação permitida.

A lista cobre as principais classes de situação que devemos implementar e testar; riscos específicos de novos projetos poderão acrescentar novos casos.

## 5. Onde exatamente o JEV pode atuar?

Agora vamos mapear o JEV de forma mais precisa.

Eu criaria um JEV Strategy Adapter, acionado pelo Decision Engine exclusivamente em decisões semanticamente incertas e bem delimitadas.

O JEV não precisa receber todas as informações do ticket. Recebe apenas um pequeno estado estruturado com as opções candidatas.

### Catálogo de decisões propostas para o JEV

|Código|Pergunta que o JEV ajudaria a responder|Primitiva|
|---|---|---|
|J01|Qual categoria melhor representa a solicitação?|Choice|
|J02|O ticket parece descrever uma mudança funcional ou correção?|Choice|
|J03|Qual domínio candidato deve ser investigado primeiro?|Choice|
|J04|Este documento adicional parece relevante para a feature?|Noul|
|J05|Quanto este trecho contribui para o objetivo do ticket?|Score|
|J06|Qual relação indireta merece investigação?|Choice|
|J07|O ticket parece semanticamente semelhante a outro já registrado?|Noul|
|J08|A descrição sugere a existência de um requisito implícito que precisa ser esclarecido?|Noul|
|J09|Qual grupo de documentos opcionais deve ser priorizado?|Choice|
|J10|Qual especialidade de revisão adicional parece apropriada?|Choice|
|J11|Qual tipo de dificuldade melhor descreve um bloqueio de desenvolvimento?|Choice|
|J12|O diagnóstico sugere falta de contexto ou problema de implementação?|Choice|
|J13|Entre provedores elegíveis, qual parece mais adequado à natureza da tarefa?|Choice|
|J14|Qual grupo de testes adicionais parece mais relevante?|Choice|
|J15|Esta anotação parece regra de negócio, decisão técnica ou observação?|Choice|
|J16|O documento parece semanticamente duplicado de outro?|Noul|
|J17|Este aprendizado merece proposta de incorporação à memória?|Noul|
|J18|Qual classe de incidente melhor corresponde aos sintomas apresentados?|Choice|
|J19|Qual categoria representa melhor a causa provável do retrabalho?|Choice|
|J20|Qual grupo de documentos precisa de investigação após uma falha recorrente?|Choice|

A TypeSafe informa que essas primitivas produzem resultados estruturados e distribuições de probabilidade. Isso não elimina erros de classificação; os resultados precisam ser testados em exemplos representativos do nosso domínio.

![](https://www.google.com/s2/favicons?domain=https://docs.typesafe.ai&sz=32)

TypeSafe AI

### O que o JEV não decidirá

Ele não será responsável por determinar se:

- Um usuário possui permissão para aprovar determinado recurso.
    
- Há saldo autorizado para comprar créditos.
    
- Um processo foi realmente encerrado.
    
- Um teste passou.
    
- Uma migração é segura sem inspeção técnica.
    
- Um contrato violado pode ser ignorado.
    
- Um requisito de negócio conflitante deve ser substituído.
    
- Um deploy pode acontecer sem autorização.
    

Essas decisões precisam continuar vinculadas a políticas, observações verificáveis ou aprovação humana.

### O roteamento de decisões

Eu adotaria este contrato conceitual:

```

type Strategy =
  | "DETERMINISTIC"
  | "LOCAL_ML"
  | "JEV"
  | "LLM"
  | "HUMAN";

type DecisionStatus =
  | "RESOLVED"
  | "UNCERTAIN"
  | "BLOCKED";

interface DecisionResult {
  decisionId: string;
  strategy: Strategy;
  status: DecisionStatus;

  selectedOptions: string[];
  sourceRevision: string;

  confidence?: number;
  evidenceIds: string[];

  reasonCode: string;
  requiresApproval: boolean;
}
```

Cada decisão possuiria também metadados de risco, estratégias permitidas e orçamento.

O pseudofluxo seria:

```

1. Receber pedido de decisão
2. Validar entradas, identidade e escopo
3. Aplicar todas as regras obrigatórias
4. Se houver bloqueio → BLOCKED
5. Se houver resultado determinístico suficiente → RESOLVED
6. Caso contrário, buscar e classificar candidatos localmente
7. Se a qualidade medida for suficiente → RESOLVED
8. Senão, verificar se a decisão aceita JEV
9. Se JEV estiver autorizado e disponível:
      consultar JEV com opções válidas e dados permitidos
      validar resposta e incerteza
10. Se continuar incerto:
      escalar para LLM elegível ou humano
11. Validar novamente todas as restrições obrigatórias
12. Persistir decisão, evidências, versão e resultado
```

A última validação é indispensável: nem o classificador local nem o JEV podem alterar as condições de segurança e autorização já estabelecidas.

## 6. Máquina de estados: como a fábrica saberá onde está cada ticket

Precisamos diferenciar duas coisas: o estado do ticket e o estado de uma execução.

Um ticket pode continuar aberto enquanto uma tentativa falhou, foi interrompida ou precisou trocar de provedor.

A especificação atual já prevê estes estados principais e laterais.

ESPEC-MVP.md

Fluxo dos estados principais

DRAFT

Requisitos

READY

Autorizado

WAITING_WORKER

Na fila

RUNNING

Executando

VALIDATING

Testes

REVIEW

Revisão

DOCS

Documentação

AWAITING_HUMAN

Aceite

DONE

Concluído

Estados excepcionais

WAITING_PROVIDER

PAUSED_LIMIT

PAUSED_RESOURCE

BLOCKED_RECOVERY

AUTH_REQUIRED

FAILED

CANCELLED

O diagrama acima apresenta os estados, não todas as transições. Cada retomada deve obedecer a regras explícitas e criar uma nova tentativa quando necessário.

As transições devem ser determinísticas e transacionais.

Por exemplo, um evento do cliente Claude informando que concluiu o trabalho não pode marcar um ticket como DONE. É necessário validar código, testes, documentação e aceite humano.

O sistema também precisa garantir que eventos duplicados ou atrasados não provoquem execução duplicada.

## 7. Como os agentes se relacionarão com essas tecnologias

Um aspecto importante: os agentes não são necessariamente modelos diferentes.

Tech Lead, Arquiteto, Developer, Reviewer, QA e Documentador são responsabilidades. Podemos executá-las com Claude, Codex ou Antigravity conforme elegibilidade, capacidade e resultados observados.

|Agente ou serviço|Responsabilidade principal|Tecnologia predominante|
|---|---|---|
|Tech Lead|Refinamento, planejamento, coordenação e acompanhamento|LLM + D|
|Arquiteto|Decisões estruturais e avaliação de alternativas|LLM + D|
|Context Manager|Busca, análise de impacto e preparação de contexto|D + ML + J|
|Developer|Implementação e correções|LLM + ferramentas|
|QA|Estratégia de validação e análise de falhas|Ferramentas + D + LLM|
|Reviewer|Revisão independente e achados técnicos|LLM + D|
|Documentador|Relatório, documentação atual e lessons|LLM + D|
|Memory Manager|Atualização, indexação, versões e conflitos|D + ML + LLM|
|Provider Manager|Elegibilidade, seleção, limites e disponibilidade|D + ML/J|
|Orchestrator|Estados, filas, tentativas, leases e recuperação|D|
|Learning Pipeline|Construção de dataset, treinamento e avaliação|D + ML|
|Supervisor de segurança|Isolamento, políticas e bloqueios|D + ferramentas|

No MVP, vários desses papéis podem compartilhar processos e componentes, sem que precisemos implantar doze serviços independentes.

O Tech Lead continua sendo o coordenador lógico, mas o Orchestrator determinístico é quem controla a execução real.

Isso evita que uma LLM altere estados ou dispare operações simplesmente por produzir uma instrução em linguagem natural.

## 8. Quais informações devemos persistir para tudo funcionar?

Eu faria o registro de decisões desde o início, mesmo antes de termos JEV habilitado ou classificador próprio treinado.

### Contrato de uma decisão

```

{
  "decision_id": "DEC-000127",
  "project_id": "fabrica",
  "ticket_id": "FAC-025",
  "run_id": "RUN-008",
  "attempt_id": "ATT-002",

  "decision_type": "CONTEXT_SELECTION",
  "strategy": "LOCAL_ML",
  "strategy_version": "1.0.0",

  "source_revision": "git-sha-verificado",
  "context_manifest_id": "CTX-042",

  "candidate_ids": [
    "DOC-001",
    "DOC-002",
    "DOC-003"
  ],

  "selected_ids": [
    "DOC-001",
    "DOC-003"
  ],

  "evidence_ids": [
    "EVD-001"
  ],

  "status": "RESOLVED",
  "review_status": "PENDING",

  "latency_ms": null,
  "usage": null
}
```

Esse é um contrato ilustrativo da fábrica, não um payload nativo do JEV.

Quando uma decisão envolver o JEV, também persistiremos a versão do modelo, as perguntas, as opções permitidas, o resultado recebido e os metadados de uso disponibilizados, com sanitização adequada.

Ao invés de guardar conversas gigantescas e repetitivas, persistiremos fatos operacionais estruturados, manifestos de contexto e referências para fontes versionadas.

### As principais entidades novas

|Entidade|Finalidade|
|---|---|
|`DecisionRequest`|Descreve a decisão solicitada|
|`DecisionResult`|Registra a decisão, estratégia e evidências|
|`DecisionPolicy`|Define quais estratégias são permitidas|
|`ContextCandidate`|Documento, regra ou componente candidato|
|`ContextManifest`|Fontes e versões incluídas na execução|
|`KnowledgeRelation`|Relações entre regras, módulos e contratos|
|`ModelRegistry`|Modelos locais e versões disponíveis|
|`ModelEvaluation`|Métricas e resultados de avaliação|
|`TrainingExample`|Exemplo candidato a treinamento|
|`TrainingDataset`|Conjunto versionado e validado|
|`ProviderObservation`|Capacidade, disponibilidade e uso observado|
|`DecisionAuditEvent`|Histórico auditável de decisões e alterações|

Não armazenaria necessariamente tudo em tabelas separadas desde o primeiro dia. Essas são responsabilidades lógicas que podemos consolidar no modelo relacional inicial e separar quando necessário.

## 9. Exemplo completo: uma feature atravessando a fábrica

Vamos usar uma funcionalidade do nosso próprio projeto:

> FAC-025 — Implementar recuperação automática após esgotamento da cota do provedor de IA, preservando o código produzido e permitindo continuar com outro provedor elegível.

Simulação operacional

Exemplo, não executado

Etapa 1 de 16

6%

1. Tech Lead

LLM

Interpreta a solicitação e propõe critérios de aceite.

AnteriorPróxima

Navegue pelas etapas para visualizar como diferentes tecnologias participam de uma mesma entrega.

O ponto fundamental é que as decisões e o conhecimento não ficam presos à sessão do primeiro agente. Se ele sair, o próximo recebe o checkpoint, as fontes versionadas e o estado validado da implementação.

Também não precisamos que o JEV seja chamado em todas essas etapas. Ele participa apenas das escolhas relevantes que continuarem incertas depois dos mecanismos locais.

## 10. Como evitar que o JEV se torne uma nova fonte de custo

Eu aplicaria uma política de execução muito controlada:

|Regra|Política proposta|
|---|---|
|JEV desabilitado por padrão|Sim, no MVP|
|API externa sem autorização|Bloqueada|
|Dados sensíveis no estado enviado|Proibidos|
|Perguntas repetidas com mesmo estado e versão|Reutilizar resultado válido quando apropriado|
|Centenas de avaliações individuais por ticket|Evitar|
|Número de chamadas por ticket|Limitado por configuração e orçamento|
|JEV sem resposta|Usar fallback permitido ou pausar|
|Decisão de alto risco|Escalar; não executar apenas pelo score|
|Baixa confiança|Solicitar análise adicional|
|Registro de consumo|Obrigatório quando observável|

Além disso, precisamos medir se o JEV efetivamente melhora a seleção.

Uma chamada barata que gera uma escolha errada e exige refazer uma feature pode ser mais cara operacionalmente do que uma investigação inicial mais completa.

Para o modelo local próprio, adotaria inicialmente o mesmo contrato de decisão. Assim poderemos comparar os resultados do JEV e do classificador local em dados equivalentes, quando houver autorização para o experimento.

## 11. O que entra agora no MVP e o que deixamos preparado

Não considero adequado tentar implementar as 145 operações com toda a sofisticação proposta logo de início.

Nosso MVP atual já possui 13 tickets planejados e um experimento de dez entregas. Nenhuma implementação foi confirmada na documentação atual.

BACKLOG.md

Eu faria a seguinte divisão:

|Capacidade|MVP|Evolução|
|---|---|---|
|Registro de tickets e critérios|Completo|Melhoria de UX|
|Máquina de estados e auditoria|Completa|Novos fluxos|
|Motor determinístico|Essencial|Novas regras|
|Busca textual e arquivos do projeto|Essencial|Índices sofisticados|
|Context Pack versionado|Essencial|Otimização adaptativa|
|Segurança e execução isolada|Essencial|Maior escala|
|Testes, revisão e documentação|Essencial|Especializações|
|Handoff entre dois provedores|Essencial|Roteamento avançado|
|Registro de decisões para treinamento|Estrutura inicial|Datasets consolidados|
|Modelo pré-treinado de embeddings|Piloto local mensurado|Expansão|
|JEV Strategy Adapter|Contrato e integração desativada|Avaliação controlada|
|Classificador próprio treinado|Interface preparada|Treinamento e implantação|
|Aprendizado automático periódico|Não|Após dados suficientes|
|Agentes especializados adicionais|Papéis lógicos essenciais|Expansão por necessidade|

### Como eu reorganizaria o backlog

O FAC-006 continua sendo o ponto de entrada do Context Builder, mas passaria a representar uma capacidade básica, não todo o Memory Engine.

Acrescentaria três tickets de evolução, provisoriamente:

FAC-014 — Decision Engine e políticas de escalonamento. Contratos, estratégias determinísticas, pontos de decisão e trilha de auditoria.

FAC-015 — Local Intelligence Engine. Modelo de embeddings, ranking local, experimentos de recuperação e avaliação de recursos na VPS.

FAC-016 — JEV Adapter e Learning Pipeline. Adaptador desabilitado por padrão, coleta de exemplos, conjuntos de avaliação e preparação do classificador próprio.

A numeração é uma proposta que ainda deve ser conciliada com o backlog real antes de se tornar oficial.

E manteria uma restrição: não adicionar segundo executor, novos bancos ou APIs pagas apenas porque a arquitetura futura já os prevê.

## 12. O que eu considero essencial acrescentar à documentação

Além do fluxo detalhado, criaria uma especificação de decisões. Ela será tão importante quanto a arquitetura de serviços.

Cada tipo de decisão deverá declarar:

- Seu identificador e objetivo.
    
- As entradas e fontes de dados permitidas.
    
- Quais regras determinísticas são obrigatórias.
    
- Se o modelo local pode participar.
    
- Se o JEV pode ser consultado.
    
- Quando o problema exige uma LLM maior.
    
- Quando é necessária autorização humana.
    
- Limites de custo, duração e repetição.
    
- Critérios para considerar a decisão suficientemente confiável.
    
- Evidências exigidas e forma de recuperar uma falha.
    

Isso permite adicionar novas tecnologias no futuro sem redesenhar o fluxo de desenvolvimento.

Por exemplo, quando treinarmos nosso primeiro classificador próprio, ele poderá substituir o ranking local em determinados tipos de decisão. O restante da fábrica continuará obedecendo ao mesmo contrato.

### O princípio que eu adotaria oficialmente

> Toda decisão da Fábrica de Software deve ser tomada pelo mecanismo mais simples capaz de produzir um resultado suficientemente confiável e verificável, respeitando as políticas e a criticidade da operação.

Com isso, nossa arquitetura terá três qualidades que considero essenciais:

Previsibilidade: decisões operacionais e de segurança permanecem determinísticas.

Inteligência: modelos locais, JEV e LLMs entram onde existe necessidade real de interpretação.

Aprendizado: cada execução produz evidências que podem melhorar o sistema, sem transformar automaticamente resultados de IA em conhecimento oficial.

O que desenhamos aqui é uma proposta abrangente de 201 operações e situações mapeadas — 145 etapas do fluxo principal e 56 exceções — além de 20 categorias de decisões candidatas ao JEV.

O passo arquitetural mais importante agora é formalizar isso como a especificação do Workflow Engine + Decision Engine + Memory Engine, preservando a stack React, NestJS e worker Node em TypeScript, a VPS única e todas as limitações financeiras e de segurança já definidas.

Assim, mesmo que depois substituamos o JEV por nosso próprio classificador, ou passemos a utilizar outros modelos de IA, o funcionamento central da fábrica continuará coerente.

consegue transformar toda essa conversa em um arquivo md? sem deixar nada para trás. Toda a conversa

Encaminhei a tarefa para o ChatGPT Work, em uma nova conversa, para preparar o arquivo Markdown (`.md`).

A orientação é preservar toda a conversa, em ordem cronológica, sem resumir, incluindo suas perguntas, minhas respostas, tabelas, propostas arquiteturais, fluxos, códigos, decisões sobre JEV e modelos locais, roadmap de estudos e diagramas.

O arquivo também deverá identificar eventuais conteúdos visuais que não possam ser reproduzidos diretamente em Markdown, sem inventar ou omitir informações silenciosamente.

A criação e a conferência do arquivo continuarão nessa nova conversa do Work, onde você poderá obter o documento final.