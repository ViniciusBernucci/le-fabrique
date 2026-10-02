# FAC-001A — Definicao de projeto configuravel

Status: READY

## Objetivo

Permitir que o operador descreva qualquer projeto externo pelo painel da fabrica, sem inserir o piloto, suas regras ou seus comandos no codigo da Le Fabrique. A definicao persistida deve ser a fonte versionada de contexto, caminhos e checks para tickets futuros.

## Atual e esperado

Hoje `Project` guarda apenas nome, URL e referencia base. A especificacao do MVP ja exige politicas, caminhos e checks cadastrados, mas esses dados ainda nao possuem contrato runtime, persistencia ou interface. Contas, providers, modelos e papeis ja pertencem ao Centro de Configuracoes e nao fazem parte deste incremento.

O esperado e que cada projeto possa receber uma definicao completa e atualizavel com concorrencia otimista. Tickets continuam podendo ser rascunhados, mas `READY` deve falhar fechado enquanto a definicao nao existir.

## Escopo permitido e proibido

- Permitido: contrato compartilhado estrito; persistencia PostgreSQL; migration aditiva; rotas administrativas; painel React; gate transacional de READY; testes e documentacao.
- Permitido: descricao, stack externa, instrucoes, caminhos permitidos/proibidos e checks representados por executavel e argumentos, sem shell.
- Proibido: hardcode do piloto, repositorio, stack externa, comandos ou contas de IA.
- Proibido: alterar o Centro de Configuracoes, autenticar providers, executar checks, clonar repositorio, criar PR, merge ou deploy.
- Proibido: apagar ou reescrever projetos, tickets, eventos ou jobs existentes.

## Criterios de aceite verificaveis

1. Contrato runtime estrito valida descricao, stack, instrucoes, caminhos relativos e de um a vinte checks com `command` e `args` separados.
2. Caminhos absolutos, vazios, com `..` ou barra invertida sao recusados; listas duplicadas ou sobrepostas entre permitido/proibido tambem sao recusadas.
3. `PUT /api/projects/{projectId}/definition` cria a versao 1 com `expectedVersion: 0` e atualiza versoes existentes por comparacao otimista.
4. Projeto inexistente, versao obsoleta ou payload invalido nao produz escrita parcial.
5. `GET /api/projects/{projectId}/definition` distingue definicao ausente de configurada sem inventar defaults executaveis.
6. `DRAFT -> READY` exige definicao persistida alem do SHA-base exato e associa a versao da definicao ao novo evento.
7. Retry idempotente de ticket ja READY permanece valido e nao exige reavaliar configuracao alterada depois do evento original.
8. O painel permite criar e editar a definicao do projeto selecionado, mostra sua versao e explica o bloqueio de READY.
9. Nenhum provider, modelo, conta, piloto ou comando e embutido no codigo como configuracao real.
10. Lint, typecheck, testes, build, Prisma validate e `git diff --check` passam.

## Baseline e comandos de checks

- Base: `4630ce0f85ef549c520c758e6870fdb874de8c55f`.
- Branch/worktree: `feat/fac-001a-project-definition`, `/home/vinicius/le-fabrique-fac-001a`.
- Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, Prisma validate com URL sintetica e `git diff --check`.

## Risco e orcamento

Risco R2 por contrato compartilhado, migration aditiva e mudancas em API/painel. Um writer, ate duas rodadas de correcao, sem provider do produto, API paga, extra usage, credito ou autorecharge. Nenhum banco real sera migrado neste ticket.

## Dependencias

FAC-003, FAC-003A e FAC-011. O FAC-003A permanece `AWAITING_HUMAN`; este incremento parte de sua revisao documental sem alterar seu estado de aceite.

## Entregaveis e documentacao afetada

`packages/contracts`, Prisma/API de controle, painel web, migration aditiva, testes, `documentacoes/controle`, `documentacoes/operacao`, indices, changelog, backlog e lesson existente quando houver conceito novo realmente aplicado.

## Evidencias e aceite

Codigo, checks e relatorio datado serao vinculados a revisoes exatas. DONE somente apos aceite da revisao documental exata.
