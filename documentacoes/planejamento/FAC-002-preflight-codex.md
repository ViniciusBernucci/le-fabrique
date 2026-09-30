# FAC-002 — Preflight do Codex oficial

Status: READY

## Objetivo

Comprovar, na VPS e com fixture sintetica, que o Codex CLI oficial pode executar em modo nao interativo usando a autenticacao ChatGPT ja salva, sem chaves de API herdadas e com sandbox explicito.

## Escopo

- Cliente inicial: OpenAI Codex CLI instalado em `/usr/bin/codex` pelo pacote oficial `@openai/codex`.
- Fixture permitida: `fixtures/codex-preflight`.
- Executor permitido: `scripts/fac-002-codex-preflight.sh`.
- Artefatos locais: `.artifacts/fac-002`, ignorados pelo Git e sanitizados antes de qualquer registro documental.
- Dados: somente marcadores sinteticos.

Ficam fora deste ticket: adapter integrado ao worker, execucao de projeto externo, mudanca de login/plano, API key, creditos, extra usage, autorecharge, merge e deploy.

## Criterios de aceite

1. Versao e origem do binario sao registradas.
2. `codex login status` confirma autenticacao ChatGPT com `OPENAI_API_KEY` e `CODEX_API_KEY` removidas do processo.
3. O script recusa a execucao se alguma dessas chaves estiver herdada.
4. `codex exec` conclui a fixture em JSONL, modo efemero, sandbox `read-only` e politica de aprovacao `never`.
5. Os marcadores do `AGENTS.md` e do `README.md` aparecem na resposta, sem mudanca no workspace.
6. Duracao, recursos e uso exposto pelo cliente sao medidos; modelo ou cota ausentes permanecem `UNKNOWN`/`null`.
7. O responsavel confirma separadamente que extras, creditos e autorecharge estao desligados na conta, porque o CLI nao comprova configuracoes de cobranca do portal.

## Baseline e limites

- Base: `developer` em `8214cec2790f4e51f7cad4aae490c8937f633932`.
- Branch: `feat/fac-002-codex-preflight` em worktree isolada.
- Provider elegivel para a sondagem: Codex autenticado por ChatGPT; elegibilidade final depende dos criterios acima.
- Uma execucao por vez, ate 30 minutos, sem escrita, rede solicitada ou comandos do projeto.
- Nao ler, copiar, registrar ou mover `~/.codex/auth.json`.

## Rollback

Remover a fixture, o script e este documento. Apagar `.artifacts/fac-002` remove somente evidencias locais do preflight; login e configuracao da conta nao sao alterados.
