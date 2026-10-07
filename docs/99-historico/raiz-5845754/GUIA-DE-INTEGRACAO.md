# Integração do Manual Vivo neste repositório

Migração inicial executada em branch docs/manual-vivo-inicial, worktree /home/vinicius/le-fabrique-manual-vivo, base a2cc5e0. O pacote original continua intacto em /home/vinicius/le-fabrique/reorganizacao-documental. Não foi copiado por cima do backlog/código/configuração real.

[Manual](docs/README.md), [políticas](docs/00-governanca/README.md), [mapa](docs/00-governanca/MAPA-MIGRACAO.md), [auditoria](docs/00-governanca/AUDITORIA.md), [entrega](docs/09-entregas/2026/2026-10-07-DOC-MV-001-migracao-manual-vivo.md). Originais/hash/documentos/seções estão em governança e docs/99-historico. Atalhos essenciais antigos foram mantidos após conteúdo canônico completo; bridges individuais redundantes foram removidos pelo pedido posterior do usuário.

## Revisar e adotar

1. Abrir guias e as duas políticas explicitamente. Conferir AS-IS/alvo, snapshots/destinos/seções, contratos/controllers/ADRs e pendências.
2. Rodar python3 scripts/validar-documentacao.py; para comparar fontes intactas usar --reference-root /home/vinicius/le-fabrique. Após integrar paths de origem podem conter bridges; aí validar snapshots, não comparar source realocado contra o original.
3. Revisar commit/diff e evidências finais. Aceite humano da revisão exata precede DONE documental. Merge para developer, push, deploy e ativação não fazem parte desta entrega.
4. Novos tickets usam prompts/PROMPT-INICIAL.md e prompts/PROMPT-ENTREGA.md. prompts/implementacao LF-MT permanecem planejamento futuro; não executar pelo ato de migrar docs.

## Carregamento e rollback

Autoload de nova sessão Codex/Claude/Antigravity NÃO VERIFICADO; versões só --version observadas. Fallback é abrir guias/políticas e registrar fontes/hashes, sem ampliar permissões/autenticar/ler auth para testar. Fixtures têm regras locais preservadas.

Rollback revisa dependentes e reverte só commit/patch documental; snapshot permite restaurar paths alterados sem reset destrutivo ou overwrite de trabalho anterior. Nenhum DB/serviço/credencial foi migrado. [Guia original do pacote](docs/99-historico/pacote-recebido/GUIA-DE-INTEGRACAO.md) permanece íntegro e histórico.
