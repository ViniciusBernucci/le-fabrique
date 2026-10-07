#!/usr/bin/env python3
"""Validação estrutural do pacote. Não verifica eficácia/implementação de software."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import hashlib
import json
import re
import sys
import unicodedata

def slug(value):
    value = re.sub(r'<[^>]+>', '', value)
    value = re.sub(r'[`*_]', '', value).lower().strip()
    value = ''.join(c for c in value if c.isalnum() or c in ' -_')
    return value.replace(' ', '-')

def content_without_code(text):
    out = []
    fence = None
    for line in text.splitlines():
        match = re.match(r'^\s*(`{3,}|~{3,})', line)
        if match:
            token = match.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            continue
        if fence is None:
            out.append(line)
    return '\n'.join(out), fence

def anchors(text):
    plain, _ = content_without_code(text)
    result = set()
    counts = {}
    for line in plain.splitlines():
        match = re.match(r'^#{1,6}\s+(.+?)(?:\s+#+)?$', line)
        if match:
            name = slug(match.group(1))
            n = counts.get(name, 0)
            result.add(name if n == 0 else f'{name}-{n}')
            counts[name] = n + 1
    result.update(re.findall(r'<(?:a|span)\b[^>]*\bid=["\']([^"\']+)', text))
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--reference-root', type=Path, help='Espelho de origem para também conferir fontes não alteradas.')
    args = parser.parse_args()
    root = args.root.resolve()
    errors = []
    history = root / 'docs/99-historico'
    files = sorted(p for p in root.rglob('*.md') if not p.is_relative_to(history))
    checked_links = 0
    for p in files:
        text = p.read_text()
        plain, fence = content_without_code(text)
        if fence:
            errors.append(f'Fence não fechado: {p.relative_to(root)}')
        for match in re.finditer(r'(?<!!)\[([^\]]+)\]\(([^\n)]+)\)', plain):
            target = match.group(2).strip()
            if target.startswith('<') and '>' in target:
                target = target[1:target.index('>')]
            target = re.split(r'\s+["\']', target, maxsplit=1)[0]
            parts = urlsplit(target)
            if parts.scheme or parts.netloc:
                continue
            path = unquote(parts.path)
            dest = (p.parent / path).resolve() if path else p
            checked_links += 1
            if not dest.exists():
                errors.append(f'Link ausente: {p.relative_to(root)} -> {target}')
            elif parts.fragment and dest.suffix == '.md' and not dest.is_relative_to(history):
                if unquote(parts.fragment) not in anchors(dest.read_text()):
                    errors.append(f'Anchor ausente: {p.relative_to(root)} -> {target}')

    manifest_path = root / 'docs/00-governanca/MANIFESTO-FONTES.json'
    verified_sources = 0
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        for entry in manifest['files']:
            archive = root / entry['archive']
            if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest() != entry['sha256']:
                errors.append(f'Snapshot alterado/ausente: {entry["archive"]}')
            else:
                verified_sources += 1
            if args.reference_root:
                original = args.reference_root / entry['source']
                if not original.is_file() or hashlib.sha256(original.read_bytes()).hexdigest() != entry['sha256']:
                    errors.append(f'Fonte alterada/ausente: {entry["source"]}')
    else:
        errors.append('Manifesto de fontes ausente')

    required = ['AGENTS.md', 'CLAUDE.md', 'ANTIGRAVITY.md',
        'docs/README.md', 'docs/INDEX.md', 'docs/00-governanca/POLITICA-IA.md',
        'docs/00-governanca/POLITICA-DOCUMENTACAO.md', 'docs/00-governanca/MAPA-MIGRACAO.md',
        'prompts/PROMPT-MESTRE-MIGRACAO.md', 'GUIA-DE-INTEGRACAO.md']
    for name in required:
        if not (root / name).is_file():
            errors.append(f'Entrada obrigatória ausente: {name}')
    for name in ['AGENTS.md', 'CLAUDE.md', 'ANTIGRAVITY.md']:
        p = root / name
        if p.exists() and 'docs/00-governanca/POLITICA-IA.md' not in p.read_text():
            errors.append(f'Guia não aponta política comum: {name}')

    # Índice deve listar todos os Markdown ativos; bridges possuem índice legado.
    index = (root / 'docs/INDEX.md').read_text() if (root / 'docs/INDEX.md').exists() else ''
    for p in files:
        rel = p.relative_to(root).as_posix()
        if rel.startswith(('documentacoes/', 'lessons/')):
            continue
        if f'[{rel}]' not in index:
            errors.append(f'Markdown corrente fora do índice: {rel}')

    print(json.dumps({'markdown_correntes': len(files), 'links_locais_verificados': checked_links,
        'snapshots_verificados': verified_sources, 'fontes_originais_conferidas': bool(args.reference_root),
        'historico_excluido_da_validacao_de_links': True, 'erros': errors,
        'limite': 'Checks estruturais/hashes; não comprova software, isolamento nem veracidade semântica.'}, ensure_ascii=False, indent=2))
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(main())
