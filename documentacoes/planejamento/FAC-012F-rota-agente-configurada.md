# FAC-012F — Resolver rota do agente pela configuração atual

Status: READY

## Objetivo

Transformar o snapshot configurável retornado em FAC-012E em uma rota de runtime validada por função (Developer/Reviewer etc.), sem fixar conta ou modelo no código. A decisão deve refletir a versão atual da interface em cada resolução, selecionar somente provider/modelo elegíveis e falhar fechado quando faltar adapter.

## Critérios de aceite

1. Router consulta `ControlClient.getWorkerConfiguration()` a cada resolução; não usa cache local nem fallback para outra conta/modelo.
2. `resolveAgentRoute` valida atribuição habilitada, instalação `AVAILABLE`, modelo no catálogo e provider conhecido; o resultado inclui configuração escolhida e metadata de versão/observação do snapshot.
3. Reviewer com permissão diferente de `READ_ONLY` é bloqueado; não rebaixar silenciosamente uma configuração inválida.
4. Router devolve adapter injetado correspondente ao provider, sem iniciar execução; adapter ausente (incluindo provider sem suporte) falha fechado.
5. Testes provam mudança de modelo/versão entre leituras, ausência de cache/fallback, seleção Developer/Reviewer, Reviewer write recusado, instalação/modelo inelegíveis e adapter ausente.
6. Lint, typecheck, testes, build e `git diff --check` passam.
7. Não iniciar adapter/provider, consumer, fila ou banco; não alterar configuração real, autenticação, gastos, pilot ou persistência.

## Baseline, caminhos e limites

Base `36c89e1` (FAC-012E documentado), branch `feat/fac-012f-configured-agent-route`, worktree `/home/vinicius/le-fabrique-fac-012f`. Arquivos em `apps/worker/src/agent-route.ts`, novo router testável e testes; documentação de configuração/runtime/operação/planejamento. Reutilizar `FactoryConfiguration`, snapshot e `RuntimeAdapter`; sem migration ou novas dependências. Nenhuma conta precisa estar `AVAILABLE` e nenhum provider real é elegível.

## Fora de escopo

Conectar o router ao `DeveloperWorkflow`/consumer, checkout do repositório, executar adapter, validar frescor temporal de evidência de disponibilidade, login/preflight do serviço ou escolher o piloto. A execução continua desligada.
