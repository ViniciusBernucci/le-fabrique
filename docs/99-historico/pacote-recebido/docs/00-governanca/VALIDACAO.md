# Validação do pacote documental

Data: 2026-10-06, America/Sao_Paulo. Somente artefatos documentais; aplicação não disponível neste espelho.

## Verificações executadas

O relatório estruturado de resultados está em [RESULTADO-VALIDACAO.json](RESULTADO-VALIDACAO.json). O [validador portátil](../../scripts/validar-documentacao.py) verifica links/anchors correntes, fences, índice, entradas obrigatórias, wrappers e SHA-256 dos snapshots. Com `--reference-root` também compara todas as entradas originais no espelho; padrão no repo verifica apenas snapshots para não depender do caminho antigo.

Comando usado neste espelho: `python3 output/reorganizacao-documental/scripts/validar-documentacao.py --reference-root .`, a partir do root do espelho. No repo real: `python3 scripts/validar-documentacao.py` após mesclar inventário/mapa/manifesto locais.

Originais sincronizados, PDF, pacote multi-tenant e ZIP anterior preservados byte a byte. PDF tem 45 páginas e 28 capítulos/anexo recuperados com origem por página. Cada um dos 33 membros do ZIP corresponde byte a byte ao pacote anterior disponível; não há arquivo adicional escondido no ZIP. Arquivos históricos não são corrigidos para disfarçar links antigos ausentes.

## Revisão semântica documental

Conferidos stack e status; outbox no PostgreSQL, Redis fila/cache; runtime separado do sandbox e condição de compatibilidade; ownership/fencing/quiescência; C4 em três níveis; catálogo SEC integral; FAC/LF-MT preservados sem DONE; requisitos dos quatro templates históricos incorporados; política comum e wrappers explícitos; nova entrega fora de documentacoes; sources read-only; cobertura de origem no mapa. Rotas/estados divergentes e lacunas de código permanecem auditados, sem implementação inventada.

## Limites e pendências

Não foram executados CLI de provider, aplicação, migrations, RLS, firewall, teste SEC, ensaio de backup/restore ou deploy. Autoload de agentes no repo real NÃO VERIFICADO. Fontes históricas de planos/modos não foram revalidadas integralmente; documentação oficial AGENTS foi consultada para orientação de descoberta. Extração textual do PDF não é QA de layout. Mermaid foi revisado textualmente; não houve renderização automatizada dos diagramas neste pacote.

Gate estrutural não prova veracidade semântica ou eficácia operacional. Na integração real atualizar manifesto/mapa ao novo escopo, confirmar schemas/versões/IDs, revisão de código e gates pertinentes. Manter o manifesto deste pacote como evidência de origem se ampliar escopo.
