# Fluxo de desenvolvimento com IA

Este diretório contém as skills usadas no fluxo Intranet/ORCA. O processo possui um único ponto de
coordenação: a skill [`orquestrador-fluxo-ia`](orquestrador-fluxo-ia/SKILL.md), executada pelo
[`agente orquestrador`](../orquestrador-fluxo-ia.md). Depois que o Tech Lead
conclui a especificação, o orquestrador escolhe e aciona as demais skills na ordem correta. Não é
necessário memorizar ou chamar manualmente cada componente.

O fluxo preserva a separação de responsabilidades: quem implementa não aprova o próprio código; o
code review e o QA são gates independentes; o orquestrador coordena evidências e transições, mas não
substitui esses papéis.

O canvas visual correspondente está em `../../Fluxo Dev IA (Work).canvas`.

## O que permanece manual

Existem cinco checkpoints humanos:

1. selecionar as tarefas no ClickUp;
2. executar [`tech-lead`](tech-lead/SKILL.md);
3. criar no ORCA as worktrees definidas pelo planejamento;
4. aplicar e commitar as correções propostas pelo code review;
5. fazer push das branches e abrir os Pull Requests.

Todo o restante deve avançar automaticamente até o próximo checkpoint ou até um bloqueio concreto,
como mudança arquitetural, risco destrutivo, conflito entre fontes de verdade ou credencial ausente.

## Como iniciar uma tarefa

1. Escolha a tarefa no ClickUp e forneça seu ID/link ao `tech-lead`.
2. O Tech Lead produz objetivo, escopo, fora do escopo, critérios de aceite, dependências e riscos.
3. Quando o ticket estiver `pronto para implementar`, o `tech-lead` faz o handoff para o
   `orquestrador-fluxo-ia`. Não é necessário chamar o `worktree-planner` manualmente.
4. O orquestrador executa o planejamento e para em `AGUARDANDO_WORKTREES_ORCA`.
5. Crie no ORCA somente as worktrees indicadas e confirme seus paths. A automação continua a partir
   dessa confirmação.

O agente principal precisa ter acesso aos agentes/sessões das worktrees criadas no ORCA para
delegar os planos. Se essa integração não estiver disponível, o estado permanece no gate atual e o
orquestrador gera o handoff exato, sem fingir que a delegação ocorreu.

## Sequência completa

### 1. ClickUp e especificação — manual

O usuário seleciona a tarefa e executa [`tech-lead`](tech-lead/SKILL.md).

Saída mínima:

- objetivo e resultado observável;
- escopo e fora do escopo;
- critérios de aceite;
- dependências e contratos;
- riscos, testes e documentação esperada.

Ticket incompleto não segue para implementação.

### 2. Planejamento operacional — automático

O [`orquestrador-fluxo-ia`](orquestrador-fluxo-ia/SKILL.md) aciona
[`worktree-planner`](worktree-planner/SKILL.md). No perfil Intranet, o detalhamento está em
[`worktree-planner/references/intranet.md`](worktree-planner/references/intranet.md).

São gerados em `.claude/worktrees/AAAA-MM-DD/`:

- `00-plano-{id}-{assunto}.md` — visão consolidada;
- `01-{id}-backend-{assunto}.md` — prompt da worktree backend, quando aplicável;
- `02-{id}-frontend-{assunto}.md` — prompt da worktree frontend, quando aplicável;
- `99-merge-e-limpeza-{id}-{assunto}.md` — integração e limpeza;
- `estado-{id}-{assunto}.md` — fase, gates, evidências e próxima ação.

O planejamento não executa revisão técnica. A antiga revisão embutida na implementação foi
removida para não duplicar o gate oficial.

### 3. Criação das worktrees — manual

O usuário cria as worktrees no ORCA com os nomes indicados. O agente de cada worktree renomeia sua
branch para o padrão final descrito no plano; o usuário não precisa renomeá-la manualmente.

Depois da confirmação dos paths, o estado muda de `AGUARDANDO_WORKTREES_ORCA` para
`IMPLEMENTACAO`.

### 4. Implementação e fechamento — automático

Cada agente recebe o plano da sua camada e executa
[`implementador-de-ticket`](implementador-de-ticket/SKILL.md), quando disponível.

O agente:

- implementa somente o escopo autorizado;
- cria ou atualiza testes e documentação;
- executa as validações permitidas pelo ambiente;
- usa [`fechar-entrega`](fechar-entrega/SKILL.md);
- grava o registro de entrega;
- cria o commit local, sem push;
- acrescenta a entrega ao índice diário;
- devolve um bloco `FLUXO_EVENTO` com worktree, branch, commit, registro, validações e limitações.

Documentos principais:

- `docs/historico/entregas/AAAA-MM-DD-{id}-{assunto}.md` em cada repositório tocado;
- documentação temática do módulo;
- contrato de API, quando necessário;
- `.claude/entregas/AAAA-MM-DD.md` com status do resumo do ClickUp.

O perfil detalhado de fechamento está em
[`fechar-entrega/references/intranet.md`](fechar-entrega/references/intranet.md).

### 5. Gate técnico único — automático

O orquestrador aciona [`revisor-de-codigo`](revisor-de-codigo/SKILL.md). Essa é a única entrada
oficial de revisão técnica e consolida três especialidades:

| Especialidade | Agente executor |
| --- | --- |
| Correção e performance | [`code-reviewer`](../code-reviewer.md) |
| Qualidade e aderência aos padrões | [`clean-code-reviewer`](../clean-code-reviewer.md) |
| Segurança das mudanças | [`security-reviewer`](../security-reviewer.md) |

Esses agentes não são executados novamente como gates paralelos sobre o mesmo diff. O relatório
oficial registra hashes, escopo, evidências, severidade, plano de correção e veredito em
`docs/historico/reviews/`.

Depois, [`review-loop-driver`](review-loop-driver/SKILL.md) transforma os achados confirmados em uma
fila priorizada, preservando os IDs `REVIEW-XXX`. O orquestrador commita apenas os documentos do
gate e para em `AGUARDANDO_CORRECOES_REVIEW`.

### 6. Correções do code review — sob indicação do usuário

Nada é aplicado automaticamente. O usuário escolhe, na fila, o que corrigir:

- aplica à mão e commita; ou
- indica os IDs para o agente aplicar e commitar, um a um (`aplica REVIEW-003`) ou em lote
  (`aplica REVIEW-001, REVIEW-004`, `aplica todos os ALTO`). O agente aplica só os indicados, roda
  as verificações, commita (`fix: ...`, sem push), atualiza a fila e para até a próxima indicação.

O procedimento está em "Aplicação sob indicação do usuário" do
[`review-loop-driver`](review-loop-driver/SKILL.md). Ao terminar, avise que as correções acabaram. O orquestrador aciona automaticamente a revalidação
focal do `revisor-de-codigo`, que verifica somente:

- os IDs corrigidos;
- os novos commits;
- o raio de impacto demonstrável.

Cada item fica `VERIFICADO`, `AINDA PRESENTE`, `REGRESSÃO` ou `BLOQUEADO`. Se um bloqueio persistir,
a fila é atualizada e o fluxo retorna ao mesmo checkpoint manual.

### 7. QA, correções e revalidação — automático

Sem bloqueios técnicos, o orquestrador aciona [`revisor-de-qa`](revisor-de-qa/SKILL.md).

O QA produz uma matriz com:

- critérios de aceite e cenários;
- resultado esperado e observado;
- evidências;
- `PASS`, `FAIL` ou `BLOCKED`;
- bugs `BUG-XXX` e regressões;
- veredito final.

Se o QA falhar, o orquestrador pode delegar ao `implementador-de-ticket` a correção mínima vinculada
aos critérios já aprovados. A sessão é fechada e commitada; depois o QA repete obrigatoriamente os
cenários que falharam e as regressões dentro do raio de impacto.

O ciclo de QA é limitado a três tentativas. A mesma falha persistente vira bloqueio humano com
evidência, evitando um loop infinito.

### 8. Integração e revisão final — automático

Quando code review e QA estiverem aprovados, o orquestrador executa o plano
`99-merge-e-limpeza-{id}-{assunto}.md` na branch de integração definida. `main` e `master` nunca são
destinos de trabalho.

Depois da integração:

- executa as verificações pós-merge;
- roda `revisor-de-codigo` sobre o diff integrado;
- aciona o agente [`review-guide`](../review-guide.md) para gerar o roteiro arquivo por arquivo;
- grava e commita os relatórios finais separadamente.

Um bloqueio descoberto nessa revisão retorna ao checkpoint manual de correções. Depois, a mudança é
reintegrada e revalidada.

### 9. Push e Pull Requests — manual

O orquestrador prepara:

- branches e comandos necessários;
- títulos e descrições dos PRs;
- registros de entrega;
- resultados de code review e QA;
- riscos residuais e instruções de teste.

O usuário confere o pacote, executa os pushes e abre os PRs. Em seguida, fornece ou confirma as URLs.
O estado muda de `AGUARDANDO_PUSH_PRS` para `PUBLICACAO_CLICKUP`.

### 10. Fechamento no ClickUp — automático quando disponível

O agente [`publicador-clickup`](../publicador-clickup.md) lê os blocos `clickup-resumo` dos registros de entrega, consolida as
camadas e acrescenta:

- resultado final do QA;
- riscos residuais;
- links dos PRs.

Com integração e autorização disponíveis, publica no ticket, registra o recibo no estado e muda as
linhas correspondentes do índice diário de `pendente` para `publicado`. Sem integração ou
autorização, gera o texto pronto para colar e mantém o gate pendente; nunca simula uma publicação.

## Estado persistente e retomada

O contrato completo está em
[`orquestrador-fluxo-ia/references/estado-e-gates.md`](orquestrador-fluxo-ia/references/estado-e-gates.md).

Sequência de estados:

```text
AGUARDANDO_TECH_LEAD
→ PLANEJAMENTO
→ AGUARDANDO_WORKTREES_ORCA
→ IMPLEMENTACAO
→ CODE_REVIEW
→ AGUARDANDO_CORRECOES_REVIEW
→ REVALIDACAO_REVIEW
→ QA
→ CORRECOES_QA
→ REVALIDACAO_QA
→ INTEGRACAO
→ REVISAO_FINAL
→ AGUARDANDO_PUSH_PRS
→ PUBLICACAO_CLICKUP
→ CONCLUIDO
```

Ao retomar uma tarefa, o orquestrador lê o estado e verifica a evidência do gate atual. Não avança
com base apenas em relato de sucesso. Commits, relatórios, matrizes e recibos são as provas de
transição.

## Responsabilidades das skills

| Skill | Responsabilidade | Não faz |
| --- | --- | --- |
| [`tech-lead`](tech-lead/SKILL.md) | Especificar e tornar o ticket executável | Implementar ou aprovar |
| [`orquestrador-fluxo-ia`](orquestrador-fluxo-ia/SKILL.md) | Escolher a próxima fase e coordenar evidências | Implementar, revisar ou autoaprovar |
| [`worktree-planner`](worktree-planner/SKILL.md) | Criar planos, prompts e estado | Criar worktrees ou revisar código |
| [`implementador-de-ticket`](implementador-de-ticket/SKILL.md) | Implementar ticket e correções de QA autorizadas | Corrigir achados de code review não indicados pelo usuário |
| [`fechar-entrega`](fechar-entrega/SKILL.md) | Registrar, commitar e emitir handoff | Fazer push, PR ou publicar no ClickUp |
| [`revisor-de-codigo`](revisor-de-codigo/SKILL.md) | Gate técnico e revalidação focal | Corrigir código |
| [`review-loop-driver`](review-loop-driver/SKILL.md) | Organizar a fila e aplicar/commitar os IDs indicados pelo usuário | Aplicar correção sem indicação |
| [`revisor-de-qa`](revisor-de-qa/SKILL.md) | Validar comportamento e revalidar falhas | Aprovar sem evidência executada |

Skills auxiliares continuam disponíveis para demandas específicas:

- [`arquiteto-de-software`](arquiteto-de-software/SKILL.md) — decisões estruturais e ADRs;
- [`security-audit`](security-audit/SKILL.md) — auditoria ampla, além do diff da tarefa;
- [`simplify`](simplify/SKILL.md) — simplificação explicitamente solicitada.

## Regras que atravessam o fluxo

- [`AGENTS.md`](../AGENTS.md) define papéis, independência, documentação e Definition of Done.
- [`CLAUDE.md`](../CLAUDE.md) define caminhos, Git, banco, padrões de código e limites do perfil Intranet.
- Nunca trabalhar, integrar, commitar ou fazer push em `main`/`master`.
- Push e criação de PR são sempre manuais.
- Correções de code review nunca são automáticas: só o que o usuário indicar, um a um ou em lote.
- Correções de QA podem ser automáticas porque permanecem vinculadas a critérios já aprovados.
- Relatórios e filas ficam em `docs/historico/reviews/` e recebem commits documentais separados.
- O máximo é três ciclos por gate; persistência do mesmo bloqueio exige decisão humana.

## Uso diário resumido

Na prática, o usuário precisa lembrar apenas disto:

1. rode `tech-lead` com a tarefa do ClickUp;
2. crie no ORCA as worktrees que o planejamento solicitar;
3. quando receber a fila do code review, corrija e informe os hashes;
4. quando receber o pacote final, faça push, abra os PRs e informe as URLs.

As demais chamadas são responsabilidade do `orquestrador-fluxo-ia`.
