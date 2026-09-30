#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_dir="$repo_root/fixtures/codex-preflight"
artifact_dir="${1:-$repo_root/.artifacts/fac-002}"
codex_bin="${CODEX_BIN:-codex}"

if [[ -n "${OPENAI_API_KEY:-}" || -n "${CODEX_API_KEY:-}" ]]; then
  echo "preflight recusado: remova OPENAI_API_KEY e CODEX_API_KEY do ambiente" >&2
  exit 20
fi

mkdir -p "$artifact_dir"

version="$($codex_bin --version)"
login_status="$(env -u OPENAI_API_KEY -u CODEX_API_KEY "$codex_bin" login status)"
if [[ "$login_status" != "Logged in using ChatGPT" ]]; then
  echo "preflight recusado: autenticacao ChatGPT nao confirmada" >&2
  exit 21
fi

before_status="$(git -C "$repo_root" status --porcelain --untracked-files=all)"
start_epoch="$(date +%s)"

prompt='Leia AGENTS.md e README.md desta fixture. Nao altere arquivos, nao acesse caminhos fora do diretorio atual e nao execute comandos de rede. Responda em uma unica linha contendo exatamente os dois marcadores FAC002_RULES_LOADED e FAC002_FIXTURE_OK.'

/usr/bin/time -v -o "$artifact_dir/resources.txt" \
  env -u OPENAI_API_KEY -u CODEX_API_KEY \
  "$codex_bin" --no-daemon --ask-for-approval never --sandbox read-only \
  exec --ignore-user-config --ephemeral --json --cd "$fixture_dir" "$prompt" \
  >"$artifact_dir/events.jsonl" 2>"$artifact_dir/stderr.txt"

end_epoch="$(date +%s)"
after_status="$(git -C "$repo_root" status --porcelain --untracked-files=all)"

if [[ "$before_status" != "$after_status" ]]; then
  echo "preflight falhou: o workspace foi alterado" >&2
  exit 22
fi

node - "$artifact_dir/events.jsonl" "$artifact_dir/summary.json" "$version" "$start_epoch" "$end_epoch" <<'NODE'
const fs = require('node:fs');

const [eventsPath, summaryPath, version, startedAt, finishedAt] = process.argv.slice(2);
const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean);
const events = lines.map((line) => JSON.parse(line));
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

const summary = {
  schema_version: 1,
  provider: 'openai-codex-cli',
  cli_version: version,
  auth_mode: 'chatgpt',
  api_key_environment_present: false,
  sandbox: 'read-only',
  approval_policy: 'never',
  ephemeral: true,
  fixture_markers_verified: true,
  turn_status: 'completed',
  model_effective: null,
  model_effective_reason: 'not exposed by the observed JSONL events',
  usage: completed.usage ?? null,
  duration_seconds: Number(finishedAt) - Number(startedAt),
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
NODE

cat "$artifact_dir/summary.json"
