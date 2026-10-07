# Auditoria de fontes, duplicações e inconsistências

## Escopo efetivamente disponível

Foram inspecionados os 14 Markdown sincronizados e o PDF de 45 páginas, o AGENTS do espelho, o pacote multi-tenant anterior e seu ZIP. A conversa de referência foi recuperada; conteúdo serve de modelo de organização, não prova de implementação. A extração do PDF foi textual; layout não foi refeito/validado. Não foi fornecido repo executável nem acesso à VPS.

Os arquivos recuperados do PDF correspondem a 28 capítulos/anexo; originais e texto integral estão no histórico. Hashes de cada entrada permitem conferência byte a byte. [Inventário](INVENTARIO.md) e [mapa](MAPA-MIGRACAO.md) são a trilha de cobertura.

## Conflitos e tratamento

| ID | Evidências | Resolução documental / limite |
|---|---|---|
| C-01 | PDF p.4 Laravel/Angular; pacote v3 ADR-003 e pedido atual React/NestJS | Estado atual React/NestJS/worker Node-TS; PDF histórico intacto. Não houve migração de código |
| C-02 | PDF escopo pessoal; v3 tenancy | Multi-tenant é proposta atual; piloto próprio/sintético; sem liberação comercial implícita |
| C-03 | FAC-002 v2 executa três tickets cedo; v3 LF-MT gates antes de IA real | Preflight estático pode ocorrer antes; execução real aguarda sandbox/rede/broker/provider |
| C-04 | PDF CLI tools locais/autônomas; v3 auth separada e broker obrigatório | Não tratar flag JSONL/sandbox como ponte; provider incompatível disabled. Gate pendente |
| C-05 | Arquitetura PDF PAUSED_BUDGET/BLOCKED; ESPEC v2 estados mais específicos | Base atual PAUSED_RESOURCE/BLOCKED_RECOVERY; não promover aliases a enum sem código |
| C-06 | ESPEC v2 POST /tickets/{id}/runs; v3 abrevia POST /runs | Rota aninhada é referência provisória; controller/schema deve resolver. Não criar alias automaticamente |
| C-07 | INDEX original aponta arquitetura/handoff/economia/ADR-002 ausentes em disco | Recuperados do PDF com páginas; ADR-001 não localizado. Não afirmar arquivos ausentes lidos em disco |
| C-08 | ADR-002 diz v2 VPS+MacBook; matriz v1→v2 diz VPS única | Preservar ambos relatos históricos; topologia atual única inequívoca. Transição intermediária não comprovada integralmente |
| C-09 | Guia/genérico “auth na VPS” versus v3 auth por tenant fora do sandbox | Topologia física mantida; isolamento lógico adicional preservado, sem afirmar eficácia |
| C-10 | Planejamento FAC e estimativa 23–35 dias; backlog v3 somente LF-MT | Preservar FAC detalhado como histórico e catálogo planejado; atual coordena FAC/LF-MT sem prazo herdado |
| C-11 | Relatório em documentacoes/<dominio> + lesson raiz; modelo novo separa histórico | docs/09-entregas único por entrega; módulo atual em docs/03-modulos; lessons em docs/10-lessons; bridges antigos |
| C-12 | Artefatos/MD existentes, mas nenhum código/CI/teste SEC | Pacote documental criado; implementação de software NÃO VERIFICADA, nenhum ticket DONE |

## Duplicações

Política comum repetida quase literalmente em AGENTS/CLAUDE/ANTIGRAVITY e PROMPT-INICIAL; consolidada na política comum, wrappers mantêm particularidades e leitura explícita. README/INDEX/matriz/ESPEC/PDF sobrepõem objetivos/entidades/estados; a nova navegação resume e liga ao contrato canônico. Fontes de origem duplicadas não são descartadas: snapshots imutáveis com hashes; detalhes e diferenças seguem mapa.

FAC v2 do PDF e sources/PLANO-MVP têm mesma matéria; preservar plano original e extrair catálogo com IDs/status reais, sem reestimar. Changelog v3 incorpora passado v2.1; raiz nova conserva o texto inteiro do pacote mais recente, com fontes anteriores no histórico. ZIP contém outra distribuição, preservada e inventariada por membro.

## Escolhas editoriais deste pacote

GLOSSARIO/CHANGELOG/INDEX de conveniência são atalhos/índices, não cópias normativas. Módulos começam com README preenchido; capítulos separados surgem quando há matéria. ADRs 003–006 mantêm status proposto; DOC-ADR-001 é proposta de governança, não aceita automaticamente. Arquivo antigo que só apontava paths virou bridge; snapshot continua intacto.

Nenhum CLI, serviço, migration/RLS/firewall ou SEC foi executado. Não houve compra, merge/deploy, mudança de autenticação ou leitura de credenciais. Verificação documental não equivale a validação de arquitetura operacional.
