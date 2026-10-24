> Leitura: [← Anterior](07-piloto.md) · [Índice didático](../02-INDEX.md) · [Próximo →](09-backlog.md)

# Handoff para Tech Lead

## Estado atual

Atualizado pelo FAC-012AH em 2026-10-03. Controle/worker/workflow, resultados/artefatos, retomada/recovery/handoff, docs técnicas e perfis oficiais estão implementados nas revisões Z–AH; aceites exatos pendentes registrados no BACKLOG. Consumer real composto sob gate padrão false; não há fixture consumindo fila de execução. AC garante writer global no PostgreSQL e AD permite observá-lo sem projeto. 528 testes + 10 PostgreSQL + 3 Redis passaram. Piloto externo é opcional posterior, nunca bloqueio da conclusão do MVP.

## Fronteiras e contratos

- O painel consome somente contratos exportados por `packages/contracts` e acessa a API pelo proxy `/api`.
- A API controla HTTP e persistência; não executa clientes, builds ou testes.
- O worker é um processo separado e o único ponto de execução de jobs, com consumer real implementado sob gate.
- `packages/contracts` valida payloads em runtime com Zod.
- `packages/runtime` define portas e adapters oficiais; credenciais não são exportadas para controle/painel.
- PostgreSQL é a fonte de verdade; Redis/BullMQ transporta trabalho e não substitui outbox, leases ou fencing.

## Sequência recomendada

1. Escopo interno auditado implementado/verificado: followup de capacidade AH, pausa global AG, backup AF e SSE AE fechados; revisar os commits exatos.
2. Revisar incrementos exatos e preparar operação com dados sintéticos. Login/preflight do usuário do serviço e confirmação financeira dependem do responsável; prosseguir desenvolvimento independente.
3. Ativação/implantação em janela autorizada, sem inferir elegibilidade. Piloto pode ser escolhido posteriormente pela interface.

## Restrições para os próximos tickets

Manter um executor inicial e o limite global observável. Não expor PostgreSQL, Redis ou worker. Não colocar auth de providers em banco, logs, contratos do frontend ou worktrees. Não usar API de IA, extra usage, autorecharge ou fallback pago. Qualquer provisionamento de VPS, merge ou deploy requer autorização aplicável.

## Riscos abertos

Preflights reais sob UID do serviço, confirmação financeira, keyring/PR remoto, implantação/backup externo/restauração/reboot continuam não verificados. Isso não impede implementação interna. SSE implementado no AE; painel de runs, gate documental e composição do consumer já implementados, contrariando o handoff antigo. Multiusuário/rotação avançada não foram incluídos implicitamente no MVP de administrador único. [Estado detalhado](06-controle-mvp.md).

## Handoff arquitetural — memória e decisões (2026-10-09)

[Planos separados](planos-memoria-e-decisoes/00-README.md) e [requisitos/evidências/pendências](planos-memoria-e-decisoes/01-decisoes-e-dependencias.md) constituem o handoff desta análise. Objetivo: memória persistente e contexto da própria La fabrique; base inspecionada `896ef0d2c804b80711d5ad00ad96695eaaf9f2d7`; main de referência ainda requer conferência, pois a ref local aponta ao bootstrap. Stack e VPS única preservadas; recursos declarados 2 vCPUs/8 GB.

Estado alvo: memória versionada, índice/grafo, packs/expansão/continuidade, decisões auditadas, atualização/conflitos e painel. Modelos locais, integração JEV e treinamento ficam para tarefas futuras. [Contratos comuns](../05-contratos/memoria-e-decisoes/00-contratos-propostos.md) e contratos por plano são propostas, não software existente. [Matriz](planos-memoria-e-decisoes/10-matriz-fluxo.md) conserva 145/56/20 itens, sem provar implementação individual.

Sequência por dependências: fontes/autoridade → índice → pacotes → integração com decisões/workflow/painel e avaliação → modelos/treino futuros. Riscos: revisão main divergente, lacunas dinâmicas do grafo, dados/índices obsoletos, limites host inadequados e consumo externo desconhecido. Migrações devem ser aditivas/versionadas, preservar contratos atuais e permitir fallback somente quando cumprir obrigatórios.

Tech Lead deverá gerar backlog/tickets somente após avaliação das propostas técnicas relevantes; não reutilizar FAC ilustrativos da transcrição, não reabrir stack nem reimplementar tickets aceitos por leitura histórica. Preencher orçamento JEV pelo sistema e benchmark antes de ativação/modelos. Exceção específica [ADR-008](../06-decisoes/ADR-008-excecao-jev.md) não libera APIs de LLM. Sem implementação/push/deploy neste handoff.
