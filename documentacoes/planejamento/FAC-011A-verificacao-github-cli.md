# FAC-011A — Verificacao gerenciada do GitHub CLI

Status: READY

## Objetivo

Permitir que o operador solicite no Centro de Configuracoes uma verificacao somente-leitura da instalacao e autenticacao do GitHub CLI. A API persiste a intencao e publica um job dedicado; o worker executa comandos fixos e devolve apenas estado, versao e mensagem controlada, sem transportar ou exibir token.

## Escopo

- Contratos Zod para pedido, job e resultado da verificacao GitHub.
- Persistencia PostgreSQL e outbox transacional/idempotente.
- Fila BullMQ `le-fabrique.github-verification`, com concorrencia um.
- Worker com executavel fixo `gh`, argv allowlisted, `shell: false`, timeout e saida limitados.
- Consulta `gh auth status --hostname <host> --json hosts`, interpretando o JSON em vez de confiar somente no exit code.
- Remocao de `GH_TOKEN`, `GITHUB_TOKEN`, `GH_ENTERPRISE_TOKEN` e `GITHUB_ENTERPRISE_TOKEN` do ambiente do processo.
- Atualizacao atomica do estado GitHub reservada ao worker e historico resumido no painel.
- Fixtures sinteticas para CLI ausente, autenticada, sem autenticacao, timeout e resultado invalido.

## Fora do escopo

- Instalar o GitHub CLI ou executar `gh auth login`.
- Receber PAT, token, cookie, chave SSH ou segredo pelo painel/API/PostgreSQL.
- Usar `--show-token`, `--with-token`, `--insecure-storage` ou variavel de token.
- Clonar, alterar remote, criar branch/commit/PR, fazer merge, deploy ou chamada de escrita ao GitHub.
- Habilitar API de IA, extra usage, creditos, autorecharge ou fallback pago.

## Criterios de aceite

1. Somente a configuracao GitHub existente recebe verificacao, com uma verificacao ativa deduplicada.
2. Pedido e evento `github.verification.requested.v1` sao gravados na mesma transacao.
3. API nao executa a CLI; o worker usa exclusivamente o binario `gh` e comandos allowlisted.
4. Host vem da configuracao validada, nunca do output nem de argv arbitrario enviado pelo browser.
5. Variaveis de token herdadas sao removidas e nenhum token/output bruto e persistido ou retornado.
6. Resultado autenticado marca `CONNECTED`; ausencia de login marca `AUTH_REQUIRED`; binario ausente, timeout ou JSON invalido marcam `ERROR` com mensagem controlada.
7. Resultado exige identidade do worker e transicao valida; repeticao identica e idempotente.
8. Painel solicita e acompanha `PENDING`, `RUNNING`, `COMPLETED` ou `FAILED` sem afirmar conexao antes da evidencia.
9. Lint, typecheck, testes, build, validacao Prisma e `git diff --check` passam.

## Baseline, caminhos e limites

- Base aceita e registro do FAC-010C: `bf8f45edd1143ffc21f0223214d5f0b782aabf90`.
- Branch/worktree: `feat/fac-011a-github-verification`, `/home/vinicius/le-fabrique-fac-011-github`.
- Caminhos: `packages/contracts`, `apps/api`, `apps/worker`, `apps/web`, migration Prisma, documentacao e lesson pertinente.
- GitHub CLI observado neste ambiente: ausente; nenhum pacote sera instalado neste ticket.
- Timeout: 15 segundos; saida combinada: 64 KiB; um job por vez; nenhuma chamada de IA; budget adicional zero.
- Um writer e no maximo duas rodadas de correcao; sem merge, deploy ou migration aplicada.

## Provider e fontes oficiais

O provider deste ticket e GitHub CLI em modo `GH_CLI`, nao um provider de IA. A documentacao oficial define `gh auth status --hostname` e o JSON `hosts`; tambem registra que variaveis de token podem sobrepor credenciais armazenadas. O worker deve falhar fechado e nunca usar opcoes que exponham ou importem token.

- <https://cli.github.com/manual/gh_auth_status>
- <https://cli.github.com/manual/gh_help_environment>
- <https://cli.github.com/manual/gh_auth_login>

## Sequenciamento

FAC-011A comprova instalacao e estado sem mudar autenticacao. Um FAC-011B posterior podera implementar login oficial efemero iniciado pelo painel, somente depois de revisar armazenamento seguro da credencial e sem PAT no controle.

