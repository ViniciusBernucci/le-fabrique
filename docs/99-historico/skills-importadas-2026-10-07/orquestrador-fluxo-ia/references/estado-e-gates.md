# Estado persistente e gates

## Arquivo de estado

Use o arquivo criado pelo `worktree-planner`:

`.claude/worktrees/AAAA-MM-DD/estado-{id}-{assunto}.md`

Ele é o ponto de retomada entre sessões e agentes. Atualize o mesmo arquivo; não crie cópias por etapa. Escritas concorrentes devem ser serializadas pelo orquestrador.

Campos mínimos:

```markdown
# Estado do fluxo — {id} — {assunto}

- Ticket ClickUp: {id e link}
- Fase atual: {estado}
- Branch de integração: {branch, nunca main/master}
- Publicação ClickUp: {autorizada|manual}
- Ciclos de code review: 0/3
- Ciclos de QA: 0/3
- Última atualização: {data-hora}

## Worktrees
| Camada | Path | Branch | Commit atual | Situação |

## Gates
| Gate | Estado | Evidência |
| Especificação | pendente | |
| Planejamento | pendente | |
| Implementação | pendente | |
| Code review | pendente | |
| Correções de review | pendente | |
| QA | pendente | |
| Integração | pendente | |
| Revisão final | pendente | |
| PRs | pendente | |
| ClickUp | pendente | |

## Próxima ação
{uma ação executável e o responsável}

## Histórico de transições
| Data-hora | De | Para | Evidência/decisão |
```

## Estados

`AGUARDANDO_TECH_LEAD` → `PLANEJAMENTO` → `AGUARDANDO_WORKTREES_ORCA` → `IMPLEMENTACAO` → `CODE_REVIEW` → `AGUARDANDO_CORRECOES_REVIEW` → `REVALIDACAO_REVIEW` → `QA` → `CORRECOES_QA` → `REVALIDACAO_QA` → `INTEGRACAO` → `REVISAO_FINAL` → `AGUARDANDO_PUSH_PRS` → `PUBLICACAO_CLICKUP` → `CONCLUIDO`.

Estados sem trabalho necessário podem ser marcados `não aplicável`, com motivo. `BLOQUEADO` sempre informa condição de saída.

## Condições de avanço

| De | Evidência mínima para avançar |
| --- | --- |
| AGUARDANDO_TECH_LEAD | objetivo, escopo, fora do escopo e critérios observáveis produzidos pelo Tech Lead |
| PLANEJAMENTO | `00`, planos das camadas, `99` e este estado gravados |
| IMPLEMENTACAO | commit por worktree, testes/limitações e registro de entrega |
| CODE_REVIEW | relatório oficial com veredito e hashes do escopo |
| AGUARDANDO_CORRECOES_REVIEW | usuário diz que terminou as correções; hashes dos commits, feitos por ele ou pelo agente sob indicação de IDs, registrados na fila |
| REVALIDACAO_REVIEW | IDs corrigidos verificados no novo commit |
| QA | matriz/relatório com todos os critérios essenciais executados |
| REVALIDACAO_QA | falhas e regressões impactadas em `PASS` |
| INTEGRACAO | commits integrados, status limpo e verificações pós-merge |
| REVISAO_FINAL | revisão do diff integrado sem bloqueios e guia final gerado |
| AGUARDANDO_PUSH_PRS | usuário confirma as URLs dos PRs |
| PUBLICACAO_CLICKUP | publicação ClickUp confirmada, ou handoff explicitamente aceito |

Um commit posterior invalida somente as evidências que ele pode afetar. Revalide focalmente; não repita todo o fluxo sem relação causal.
