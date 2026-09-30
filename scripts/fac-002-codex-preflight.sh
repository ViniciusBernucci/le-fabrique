#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$repo_root/fixtures/codex-preflight"
isolation_fixture_dir="$repo_root/fixtures/codex-preflight-isolation"
write_fixture_source="$repo_root/fixtures/codex-preflight-write"
artifact_dir="${1:-$repo_root/.artifacts/fac-002}"
write_fixture_dir="$artifact_dir/write-fixture"
codex_bin="${CODEX_BIN:-codex}"
codex_permissions=(
  --no-daemon
  --ask-for-approval never
  -c 'default_permissions="fac002"'
  -c 'permissions.fac002={ description="FAC-002 workspace-only read", filesystem={ ":root"="deny", ":minimal"="read", ":workspace_roots"={ "."="read" } }, network={ enabled=false } }'
)
codex_write_permissions=(
  --no-daemon
  --ask-for-approval never
  -c 'default_permissions="fac002write"'
  -c 'permissions.fac002write={ description="FAC-002 workspace-only write", filesystem={ ":root"="deny", ":minimal"="read", ":workspace_roots"={ "."="write" } }, network={ enabled=false } }'
)

if [[ -n "${OPENAI_API_KEY:-}" || -n "${CODEX_API_KEY:-}" ]]; then
  echo "preflight recusado: remova OPENAI_API_KEY e CODEX_API_KEY do ambiente" >&2
  exit 20
fi

mkdir -p "$artifact_dir"
rm -rf "$write_fixture_dir"
cp -a "$write_fixture_source" "$write_fixture_dir"

version="$($codex_bin --version)"
login_status="$(env -u OPENAI_API_KEY -u CODEX_API_KEY "$codex_bin" login status 2>&1)"
if [[ "$login_status" != "Logged in using ChatGPT" ]]; then
  echo "preflight recusado: autenticacao ChatGPT nao confirmada" >&2
  exit 21
fi

before_status="$(git -C "$repo_root" status --porcelain --untracked-files=all)"
start_epoch="$(date +%s)"

prompt='Leia AGENTS.md e README.md desta fixture. Nao altere arquivos, nao acesse caminhos fora do diretorio atual e nao execute comandos de rede. Responda em uma unica linha contendo exatamente os dois marcadores FAC002_RULES_LOADED e FAC002_FIXTURE_OK.'
isolation_prompt='Execute exatamente: if test -r "$HOME/.codex/auth.json"; then echo AUTH_FILE_READABLE; else echo AUTH_FILE_BLOCKED; fi. Nao execute nenhum outro comando e nao leia o conteudo do arquivo. Responda somente com o marcador retornado.'
write_prompt='Siga AGENTS.md: altere somente result.txt, execute node check.cjs e responda apenas FAC002_WRITE_CHECK_PASSED.'

/usr/bin/time -v -o "$artifact_dir/resources.txt" \
  env -u OPENAI_API_KEY -u CODEX_API_KEY \
  "$codex_bin" "${codex_permissions[@]}" \
  exec --ignore-user-config --ephemeral --json --cd "$fixture_dir" "$prompt" \
  >"$artifact_dir/events.jsonl" 2>"$artifact_dir/stderr.txt"

env -u OPENAI_API_KEY -u CODEX_API_KEY \
  "$codex_bin" "${codex_permissions[@]}" \
  exec --ignore-user-config --ephemeral --json --cd "$isolation_fixture_dir" "$isolation_prompt" \
  >"$artifact_dir/isolation-events.jsonl" 2>"$artifact_dir/isolation-stderr.txt"

env -u OPENAI_API_KEY -u CODEX_API_KEY \
  "$codex_bin" "${codex_write_permissions[@]}" \
  exec --ignore-user-config --ephemeral --json --cd "$write_fixture_dir" "$write_prompt" \
  >"$artifact_dir/write-events.jsonl" 2>"$artifact_dir/write-stderr.txt"

(cd "$write_fixture_dir" && node check.cjs) >"$artifact_dir/write-check.txt"

end_epoch="$(date +%s)"
after_status="$(git -C "$repo_root" status --porcelain --untracked-files=all)"

if [[ "$before_status" != "$after_status" ]]; then
  echo "preflight falhou: o workspace foi alterado" >&2
  exit 22
fi

node - "$artifact_dir/events.jsonl" "$artifact_dir/isolation-events.jsonl" "$artifact_dir/write-events.jsonl" "$artifact_dir/summary.json" "$version" "$start_epoch" "$end_epoch" <<'NODE'
const fs = require('node:fs');

const [eventsPath, isolationEventsPath, writeEventsPath, summaryPath, version, startedAt, finishedAt] = process.argv.slice(2);
const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean);
const events = lines.map((line) => JSON.parse(line));
const isolationEvents = fs.readFileSync(isolationEventsPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const writeEvents = fs.readFileSync(writeEventsPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const completed = events.find((event) => event.type === 'turn.completed');
const failed = events.find((event) => event.type === 'turn.failed' || event.type === 'error');
const messages = events
  .filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message')
  .map((event) => event.item.text ?? '')
  .join('\n');

if (failed || !completed) {
  throw new Error('turno nao concluido com sucesso');
}
if (!messages.includes('FAC002_RULES_LOADED') || !messages.includes('FAC002_FIXTURE_OK')) {
  throw new Error('marcadores da fixture ausentes');
}

const isolationFailed = isolationEvents.find((event) => event.type === 'turn.failed' || event.type === 'error');
const isolationCompleted = isolationEvents.find((event) => event.type === 'turn.completed');
const isolationMessages = isolationEvents
  .filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message')
  .map((event) => event.item.text ?? '')
  .join('\n');
if (isolationFailed || !isolationCompleted || !isolationMessages.includes('AUTH_FILE_BLOCKED')) {
  throw new Error('arquivo de autenticacao legivel pelos comandos do sandbox');
}

const writeFailed = writeEvents.find((event) => event.type === 'turn.failed' || event.type === 'error');
const writeCompleted = writeEvents.find((event) => event.type === 'turn.completed');
const writeMessages = writeEvents
  .filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message')
  .map((event) => event.item.text ?? '')
  .join('\n');
if (writeFailed || !writeCompleted || !writeMessages.includes('FAC002_WRITE_CHECK_PASSED')) {
  throw new Error('fixture de escrita nao concluida');
}

const summary = {
  schema_version: 1,
  provider: 'openai-codex-cli',
  cli_version: version,
  auth_mode: 'chatgpt',
  api_key_environment_present: false,
  permission_profile: 'workspace-only-read',
  filesystem_root_default: 'deny',
  workspace_access: 'read',
  command_network_enabled: false,
  approval_policy: 'never',
  ephemeral: true,
  fixture_markers_verified: true,
  disposable_write_fixture_verified: true,
  auth_file_blocked_from_sandbox_commands: true,
  turn_status: 'completed',
  model_effective: null,
  model_effective_reason: 'not exposed by the observed JSONL events',
  usage: completed.usage ?? null,
  duration_seconds: Number(finishedAt) - Number(startedAt),
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
NODE

cat "$artifact_dir/summary.json"
