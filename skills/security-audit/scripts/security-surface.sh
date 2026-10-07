#!/usr/bin/env bash
# Local candidate paths only. No credential values or source snippets are emitted.
set -euo pipefail
project_root="${1:-.}"
if [[ ! -d "$project_root" ]]; then
  printf 'security-surface: diretório inexistente\n' >&2
  exit 64
fi
if ! command -v rg >/dev/null 2>&1; then
  printf 'security-surface: rg indisponível\n' >&2
  exit 69
fi
cd "$project_root"
scan_roots=()
for candidate_root in apps packages scripts infraestrutura infra .github; do
  if [[ -d "$candidate_root" && ! -L "$candidate_root" ]]; then
    scan_roots+=("$candidate_root")
  fi
done
printf '# Candidatos por path; não são vulnerabilidades\n'
if [[ ${#scan_roots[@]} -eq 0 ]]; then
  printf 'Nenhuma área de código reconhecida; cobertura vazia.\n'
  exit 0
fi
file_options=(--hidden
  --glob '*.ts' --glob '*.tsx' --glob '*.mjs' --glob '*.js'
  --glob '*.sh' --glob '*.prisma' --glob '*.sql' --glob '*.json'
  --glob '*.yml' --glob '*.yaml' --glob 'Dockerfile*'
  --glob '!**/node_modules/**' --glob '!**/dist/**'
  --glob '!**/coverage/**' --glob '!**/.git/**' --glob '!**/sources/**'
  --glob '!**/artifacts/**' --glob '!**/evidencias/**' --glob '!**/.env*'
  --glob '!**/auth.json' --glob '!**/credentials*' --glob '!**/secrets*'
  --glob '!**/*.pem' --glob '!**/*.key' --glob '!**/*.map')
pattern='child_process|spawn\(|execFile\(|shell:|Authorization|Bearer|dangerouslySetInnerHTML|\$queryRaw|\$executeRaw|fetch\(|symlink|realpath|fencing|stopped_confirmed|process\.env|privateKey|timeout|outbox|lease|capabilit'
checked=0
reported=0
while IFS= read -r -d '' candidate_file; do
  if [[ -L "$candidate_file" ]]; then continue; fi
  checked=$((checked + 1))
  if rg --quiet --regexp "$pattern" -- "$candidate_file"; then
    reported=$((reported + 1))
    if [[ "$reported" -le 150 ]]; then
      printf '%s\n' "$candidate_file"
    fi
  fi
done < <(rg --files --null "${file_options[@]}" -- "${scan_roots[@]}")
printf 'Arquivos examinados: %s; paths candidatos: %s; limite de saída: 150.\n' "$checked" "$reported"
printf 'Cobertura limitada: código reconhecido; histórico, credenciais e symlinks omitidos.\n'
