# Centro de configuracoes

Status: IMPLEMENTADO e ACEITO no FAC-011, revisao `e41ec1e45273aba3205f266e8753dfca305c5952`.

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
4. FAC-011A verifica binario e autenticacao GitHub por comando somente-leitura; login e PR continuam tickets separados e merge continua manual.

## Verificacao de instalacoes

FAC-010A implementa `Verificar instalacao`. Pedido/outbox sao persistidos e o worker executa apenas comandos allowlisted, nunca o caminho editavel no painel. Historico mostra estado, versao e modelos sanitizados; output bruto nao e armazenado. Essa verificacao nao faz login nem torna uma conta elegivel quando o cliente informa `AUTH_REQUIRED`.

## Login efemero do Codex

FAC-010B implementa `Conectar assinatura Codex` para instalacao habilitada em `AUTH_REQUIRED`. A sessao e a intencao ficam no PostgreSQL/outbox, mas URL e codigo temporarios existem somente no Redis privado por ate dez minutos e no estado em memoria da tela. O worker executa `codex login --device-auth`, nunca o executavel editavel, e confirma com `codex login status` antes de atualizar o estado observado.

O painel nao recebe senha, token, cookie ou cache de autenticacao. Claude e Antigravity continuam sem botao de login gerenciado ate seus fluxos oficiais seguros serem comprovados. Detalhes e evidencias: [2026-10-01-FAC-010B-login-efemero-codex.md](2026-10-01-FAC-010B-login-efemero-codex.md).

## Rota por funcionario

FAC-010C consome a escolha de conta, modelo e permissao feita em `Funcionarios digitais`. A rota so existe quando a atribuicao esta habilitada, a instalacao esta habilitada e `AVAILABLE`, o modelo pertence ao catalogo e o provider possui adapter. Claude Console/API, autenticacao ambigua e Antigravity sem adapter falham fechado; nenhuma troca silenciosa substitui a escolha configurada.
