# Onde colocar os arquivos e ordem da migração

## O que já foi feito

A documentação disponível neste espelho foi reorganizada em pacote independente, com originais preservados, contratos/módulos planejados, C4, governança, auditoria e templates. sources/ e o pacote anterior não foram alterados. A integração no repositório executável ainda precisa ocorrer porque ele não está neste espelho.

## Destinos no repositório real

| Conteúdo do pacote | Destino | Como integrar |
|---|---|---|
| docs/ | <repo>/docs/ | Mesclar com docs existentes; preservar fontes reais e histórico |
| AGENTS.md | <repo>/AGENTS.md | Mesclar regras atuais; trocar apenas obrigação documental antiga conflitante |
| CLAUDE.md | <repo>/CLAUDE.md | Mesclar, mantendo comandos/capacidades locais verificadas |
| ANTIGRAVITY.md | <repo>/ANTIGRAVITY.md | Guia explícito; testar leitura na superfície instalada |
| .agents/rules/documentacao.md | <repo>/.agents/rules/documentacao.md | Ponte para política; não presumir autoload |
| prompts/PROMPT-MESTRE-MIGRACAO.md | <repo>/prompts/PROMPT-MESTRE-MIGRACAO.md | Executar após inventário/integração básica; serve aos três agentes |
| prompts/PROMPT-ENTREGA.md | <repo>/prompts/PROMPT-ENTREGA.md | Usar em entregas futuras |
| prompts/implementacao/ | <repo>/prompts/implementacao/ | Versões editoriais dos prompts LF-MT com paths novos; não executar na migração documental |
| scripts/validar-documentacao.py | <repo>/scripts/validar-documentacao.py | Validador portátil stdlib; integrar no CI real quando apropriado |
| README/BACKLOG/CHANGELOG de raiz | respectivas raízes | Mesclar; nunca substituir setup/backlog real por planejamento do espelho |
| PILOTO/PLANO/ESPEC/MATRIZ/FONTES de raiz | respectivas raízes | Bridges; transferir conteúdo local adicional antes de substituir |
| documentacoes/ e lessons/INDEX bridges | antigos paths do repo | Usar só se correspondem aos paths antigos; migrar relatórios/lessons locais não presentes aqui |

Não instalar wrappers globais no home do agente: são regras deste projeto. Não copiar AGENTS sobre o AGENTS do espelho, que protege sources/. Não ativar runtime/gastos pelo simples ato de instalar instruções.

## Ordem recomendada

1. **Inventário e baseline.** No repo real, registrar root/branch/SHA/status/untracked e instruções hierárquicas. Criar branch/workspace documental preservando alterações prévias. Localizar todos os MD/PDF/schema/runbook/lessons e gerar novo manifesto do repo. Este manifesto do pacote só cobre suas entradas, não o repo real.
2. **Preservação.** Snapshot íntegro com hashes de tudo que será realocado; copiar artefatos ignorados necessários fora do snapshot Git quando apropriado. Conferir secret policy antes de arquivar material do repo real. Não copiar secrets.
3. **Mescla de governança.** Integrar docs/00-governanca e wrappers na raiz, mantendo regras locais de engenharia. Resolver exigência duplicada documentacoes versus docs para novos registros. Conferir overrides sem alterá-los cegamente.
4. **Conteúdo atual.** Integrar Manual/C4/módulos/features/contratos/operação/desenvolvimento; atualizar com código real. Transferir trechos adicionais de documentos locais ao destino canônico, registrando seção→destino. Preservar planejamento separado de implementação. Não migrar Laravel para Nest por esta tarefa.
5. **Decisões e planejamento.** Conferir IDs/estado de ADR e FAC/LF-MT; mesclar backlog/contratos/plano/critério. Resolver conflitos com evidência; registrar incertezas em vez de apagar. Não renumerar histórico automaticamente.
6. **Histórico e compatibilidade.** Realocar entregas existentes a docs/09-entregas e lessons aplicadas a docs/10-lessons; manter datas/IDs/SHA. Preservar snapshots e inserir bridges em antigos paths só após assegurar destino completo; corrigir links no texto corrente e prompts. Não editar snapshot imutável para “consertar” link histórico.
7. **Validar e revisar.** Rodar `python3 scripts/validar-documentacao.py`; revisar semântica frente ao código, templates, fences, C4, links e cobertura. Conferir o mapa do repo real. O relatório deste pacote não substitui revisão real nem habilita controle de segurança.
8. **Testar leitura.** Nova sessão em cada agente pede fontes ativas e destinos de docs. Se não carregar, injetar conteúdo explicitamente; confirmar sem ampliar permissões. Registrar versão/limite/override relevantes.
9. **Entregar migração.** Criar registro documental com diff/revisão/checks e pendências; atualizar índice/changelog. Submeter a revisão/aceite. Backlog de software permanece como estava; nenhum FAC/LF-MT DONE por reorganização.
10. **Rotina contínua.** Usar prompt de entrega e matriz de impacto. Código + docs atuais + registro histórico caminham juntos; lessons e ADRs por necessidade.

## Como executar o prompt

Após disponibilizar o pacote ao agente no repo real, enviar: “Leia prompts/PROMPT-MESTRE-MIGRACAO.md e execute a migração documental descrita, preservando regras locais e todo conteúdo útil.” O arquivo é completo e não depende da memória desta conversa. Para Antigravity incluir explicitamente guia e políticas se a descoberta não for comprovada.

## Aceite e reversão

Migração aceita quando cada fonte/seção tem destino ou justificativa histórica, links correntes passam, histórico/hash íntegro, guias usam uma política, docs correspondem ao código e lacunas honestas permanecem explícitas. Se falhar, corrigir preservando snapshot; não remover originais para forçar gate.

Reversão no repo: reverter somente o commit/patch documental desta migração após revisar dependentes; se sem Git, restaurar apenas arquivos alterados pelo mapa a partir do snapshot. Não usar reset destrutivo nem sobrescrever mudanças prévias. Não reverter código/DB/credenciais: não fazem parte desta tarefa.
