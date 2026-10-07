#!/usr/bin/env python3
"""Validação estrutural do pacote. Não verifica eficácia/implementação de software."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import hashlib
import json
import os
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
    excluded = {'.git', 'node_modules', 'dist', 'coverage', 'sources', 'reorganizacao-documental'}
    files = sorted(p for p in root.rglob('*.md') if not p.is_relative_to(history)
        and not p.is_relative_to(root / '.agents/skills')
        and not any(part in excluded for part in p.relative_to(root).parts))
    checked_links = 0
    for p in files:
        text = p.read_text()
        plain, fence = content_without_code(text)
        if fence:
            errors.append(f'Fence não fechado: {p.relative_to(root)}')
        for match in re.finditer(r'!?\[([^\]]+)\]\(([^\n)]+)\)', plain):
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

    section_path = root / 'docs/00-governanca/MAPA-SECOES-REPO.json'
    destinations_path = root / 'docs/00-governanca/DESTINOS-REPO.json'
    checked_sections = 0
    if section_path.is_file() and destinations_path.is_file():
        section_map = json.loads(section_path.read_text())
        destinations = json.loads(destinations_path.read_text())
        manifest_sources = {e['source']: root / e['archive'] for e in manifest['files']}
        by_source = {}
        for section in section_map:
            by_source.setdefault(section['source'], []).append(section)
            target = root / section['destination']
            if not target.exists():
                errors.append(f"Destino de seção ausente: {section['source']} -> {section['destination']}")
            checked_sections += 1
        for source, archive in manifest_sources.items():
            if archive.suffix != '.md':
                continue
            original = archive.read_text()
            spans = list(re.finditer(r'^#{1,6}\s+(.+)$', original, re.M))
            bounds = [0] + [m.start() for m in spans] + [len(original)]
            expected = [hashlib.sha256(original[bounds[i]:bounds[i+1]].encode()).hexdigest()
                for i in range(len(bounds)-1) if original[bounds[i]:bounds[i+1]].strip()]
            observed = [s['sha256'] for s in by_source.get(source, [])]
            if expected != observed:
                errors.append(f'Cobertura/hash de seções incompleto: {source}')
        for source, dest in destinations.items():
            if not (root / dest).is_file():
                errors.append(f'Destino canônico ausente: {source} -> {dest}')
    else:
        errors.append('Mapa de seções/destinos do repo ausente')

    relocation_path = root / 'docs/00-governanca/REALOCACAO-RAIZ.json'
    if relocation_path.is_file():
        relocation = json.loads(relocation_path.read_text())
        for entry in relocation['files']:
            archive = root / entry['archive']
            if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest() != entry['sha256']:
                errors.append(f"Snapshot da raiz alterado/ausente: {entry['archive']}")
            if (root / entry['source']).exists():
                errors.append(f"Atalho redundante recriado na raiz: {entry['source']}")
            if not (root / entry['destination']).is_file():
                errors.append(f"Destino da raiz ausente: {entry['destination']}")

    legacy_map = root / 'docs/00-governanca/REMOCAO-DOCUMENTACOES.json'
    if legacy_map.is_file():
        if (root / 'documentacoes').exists():
            errors.append('Pasta legada documentacoes recriada')
        for entry in json.loads(legacy_map.read_text())['files']:
            archive = root / entry['archive']
            target = root / entry['destination']
            if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest() != entry['sha256']:
                errors.append(f"Original legado alterado/ausente: {entry['archive']}")
            if not target.is_file():
                errors.append(f"Destino legado ausente: {entry['destination']}")
            elif entry['source'].endswith('.md') is False and hashlib.sha256(target.read_bytes()).hexdigest() != entry['sha256']:
                errors.append(f"Evidência legada alterada: {entry['destination']}")

    order_path = root / 'docs/00-governanca/ORDEM-LEITURA.json'
    if not order_path.is_file():
        errors.append('Mapa didático ORDEM-LEITURA.json ausente')
    else:
        order = json.loads(order_path.read_text())
        mapped = set()
        for entry in order['files']:
            archive = root / entry['archive']
            if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest() != entry['sha256']:
                errors.append(f"Snapshot didático alterado/ausente: {entry['archive']}")
            if not (root / entry['destination']).is_file():
                errors.append(f"Capítulo realocado ausente: {entry['destination']}")
        for group in order['groups']:
            positions = set()
            for i, name in enumerate(group['chapters']):
                target = root / name
                if name in mapped:
                    errors.append(f'Capítulo duplicado no roteiro: {name}')
                mapped.add(name)
                match = re.match(r'^(\d{2})-', target.name)
                if not match or int(match.group(1)) in positions or int(match.group(1)) != i:
                    errors.append(f'Prefixo didático ausente/duplicado: {name}')
                else:
                    positions.add(int(match.group(1)))
                if not target.is_file():
                    errors.append(f'Capítulo do roteiro ausente: {name}')
                    continue
                if name.endswith('/02-INDEX.md'):
                    continue
                text = target.read_text()
                if '> Leitura:' not in text:
                    errors.append(f'Navegação de leitura ausente: {name}')
                for neighbor in group['chapters'][max(0, i-1):i] + group['chapters'][i+1:i+2]:
                    relative = str(Path(os.path.relpath(root / neighbor, target.parent)))
                    if f']({relative})' not in text:
                        errors.append(f'Vizinho de leitura não vinculado: {name} -> {neighbor}')
        for target in files:
            rel = target.relative_to(root).as_posix()
            if not rel.startswith('docs/') or rel in order['exceptions']:
                continue
            if '/09-entregas/' in rel and not target.name.endswith('README.md'):
                continue
            if '/tickets/' in rel and not target.name.endswith('README.md'):
                continue
            if target.name.startswith(('ADR-', 'DOC-ADR-')):
                continue
            if rel not in mapped:
                errors.append(f'Capítulo fora do roteiro didático: {rel}')
        for name in order['main_trail']:
            if name not in mapped:
                errors.append(f'Trilha principal aponta capítulo não mapeado: {name}')

    skill_manifest = root / 'docs/00-governanca/ADAPTACAO-SKILLS.json'
    if skill_manifest.is_file():
        package = json.loads(skill_manifest.read_text())
        for entry in package['files'] + package.get('baseline_shared', []):
            archive = root / entry['archive']
            if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest() != entry['sha256']:
                errors.append(f"Skill importada não preservada: {entry['archive']}")
        for name in package['adapted_skills']:
            skill = root / 'skills' / name / 'SKILL.md'
            if not skill.is_file() or '../00-perfil-la-fabrique.md' not in skill.read_text():
                errors.append(f'Skill adaptada ausente/sem perfil: {name}')

    required = ['AGENTS.md', 'CLAUDE.md', 'ANTIGRAVITY.md',
        'docs/01-README.md', 'docs/02-INDEX.md', 'docs/00-governanca/01-POLITICA-IA.md',
        'docs/00-governanca/02-POLITICA-DOCUMENTACAO.md', 'docs/00-governanca/10-MAPA-MIGRACAO.md',
        'prompts/PROMPT-MESTRE-MIGRACAO.md', 'docs/00-governanca/03-GUIA-DE-INTEGRACAO.md',
        'docs/08-desenvolvimento/09-backlog.md', 'docs/04-CHANGELOG.md']
    for name in required:
        if not (root / name).is_file():
            errors.append(f'Entrada obrigatória ausente: {name}')
    for name in ['AGENTS.md', 'CLAUDE.md', 'ANTIGRAVITY.md']:
        p = root / name
        if p.exists() and 'docs/00-governanca/01-POLITICA-IA.md' not in p.read_text():
            errors.append(f'Guia não aponta política comum: {name}')

    # Índice deve listar todos os Markdown ativos; bridges possuem índice legado.
    index = (root / 'docs/02-INDEX.md').read_text() if (root / 'docs/02-INDEX.md').exists() else ''
    index_file = root / 'docs/02-INDEX.md'
    indexed_paths = set()
    for match in re.finditer(r'!?\[[^\]]+\]\(([^\n)]+)\)', index):
        parts = urlsplit(match.group(1))
        if not parts.scheme and not parts.netloc:
            indexed_paths.add((index_file.parent / unquote(parts.path)).resolve())
    for p in files:
        rel = p.relative_to(root).as_posix()
        if rel.startswith(('documentacoes/', 'lessons/')):
            continue
        if p.resolve() not in indexed_paths:
            errors.append(f'Markdown corrente fora do índice: {rel}')

    print(json.dumps({'markdown_correntes': len(files), 'links_locais_verificados': checked_links,
        'snapshots_verificados': verified_sources, 'secoes_mapeadas': checked_sections, 'fontes_originais_conferidas': bool(args.reference_root),
        'historico_excluido_da_validacao_de_links': True, 'erros': errors,
        'limite': 'Checks estruturais/hashes; não comprova software, isolamento nem veracidade semântica.'}, ensure_ascii=False, indent=2))
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(main())
