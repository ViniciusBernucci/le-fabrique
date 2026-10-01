# Centro de configuracoes

Status: IMPLEMENTADO no FAC-011 e aguardando aceite humano.

## Funcionamento atual

O painel administrativo possui as areas `Operacao` e `Configuracoes`. O Centro de Configuracoes organiza tres secoes:

- `IA e contas`: instalacoes Codex, Claude Code e Antigravity, com multiplas contas, rotulo, executavel, estado, ativacao, catalogo permitido e modelo padrao;
- `Funcionarios digitais`: Planner, Developer, Reviewer, QA, Documentation e Security, cada um com conta/modelo, modo de permissao, timeout, tentativas e ativacao proprios;
- `GitHub`: modo `GH_CLI`, estado da conexao, host, owner, repositorio, branch base e intencao de criar PR depois de gate humano.

A API autenticada expoe `GET /api/settings` e `PUT /api/settings`. A configuracao e um singleton PostgreSQL versionado; a atualizacao exige `expectedVersion` e rejeita gravacao obsoleta. Os contratos Zod estritos validam relacoes: IDs, modelos e funcoes unicos, modelo pertencente a uma instalacao habilitada, conta/modelo selecionados juntos e owner/repository do GitHub preenchidos juntos. Estados observados de provider e GitHub nao podem ser alterados pelo update administrativo: pertencem a evidencia futura do worker.

## Seguranca e limites

Credenciais nao fazem parte do schema, do DTO, da tabela ou da interface. Login de provider e GitHub sera executado futuramente pelo worker confiavel usando o fluxo oficial; o browser recebe somente metadados e estados sanitizados. Estado `AVAILABLE` nao pode ser inferido pelo cadastro: os defaults ficam desabilitados, `AUTH_REQUIRED` e sem modelos ate preflight real.

API paga, extra usage, creditos pagos, autorecharge, fallback pago e merge permanecem `false` por contrato. O painel os exibe como protecoes nao editaveis. Salvar configuracao nao executa clientes, nao conecta GitHub, nao cria PR e nao altera cobranca externa.

## Referencia funcional

O Orca inspirou a separacao entre agentes, contas e integracoes e a exibicao distinta de configuracao e disponibilidade. A implementacao e identidade visual sao proprias. A Le Fabrique nao adotou o padrao de permissao irrestrita do Orca: escrita continua explicita por funcao e o runtime mantem sandbox e gates conservadores.

## Proximos incrementos

1. Worker detecta instalacoes e executa login oficial sem transportar segredo pelo painel.
2. Preflight grava versao, modelos realmente acessiveis, estado e evidencia.
3. FAC-010 consome atribuicoes validadas para roteamento e handoff.
4. Integracao GitHub implementa conexao e PR em ticket proprio; merge continua manual.
