# Prompt mestre — migração inicial do Manual Vivo

Você está no repositório da Fábrica de Software. Execute uma reorganização documental completa e revisável usando o pacote disponível como base e a realidade deste repo como evidência. O objetivo é documentação viva didática, docs-as-code, C4 contexto/containers/componentes, módulos/features/contratos/ADRs/operação/desenvolvimento/entregas/lessons. Não basta produzir um plano ou templates: migre o conteúdo real, atualize navegação e entregue arquivos verificáveis.

## Leitura e escopo

Leia instruções locais/hierárquicas do agente, README e docs/00-governanca/POLITICA-IA.md, POLITICA-DOCUMENTACAO.md, AUDITORIA.md, MAPA-MIGRACAO.md, PENDENCIAS.md e GUIA-DE-INTEGRACAO.md. Abra esses arquivos explicitamente; link não significa inclusão automática. Se houver pacote ainda não instalado, leia seus equivalentes e mescle de forma aditiva.

Esta tarefa autoriza reorganização de documentação, governança e paths de documentação em prompts/config de gate pertinentes, preservando comportamento/segurança. Não implementa features/backlog, troca stack de código, instala providers, lê credenciais ou executa migração/produção. sources/ sincronizado é read-only. Preserve trabalho prévio e regras locais de setup/checks/segurança.

## Fase 1 — inventário com evidência

1. Confirme repo/root/branch/revisão real e mudanças existentes. Inspecione todos os documentos (incluindo ocultos de regras), schemas/API, ADRs, operação, templates, lessons, CI e PDF disponíveis, excluindo dependências/segredos.
2. Registre path, tipo, assunto, estado, hash e duplicações; use inventário completo, não apenas títulos. PDF deve ter proveniência por página; extração não preserva layout, logo guarde PDF íntegro e verifique tabelas/diagramas relevantes se ambíguos.
3. Leia conteúdo inteiro por lotes. Separe atual, planejamento, histórico, exemplo e verificação. Não alegue leitura de arquivo ausente. Código/manifests/controllers/migrations/config/testes verificam implementação, não autorrelato de ticket.
4. Snapshot íntegro de material realocado (sem secrets), hashes e mapa por documento/seção/destino/tratamento. Nenhum conteúdo útil desaparece; copie antes de transformar e confira depois.

## Fase 2 — conciliação

5. Direção atual da fábrica: React + NestJS + worker Node em TypeScript, PostgreSQL, Redis, VPS Linux única; piloto mantém stack própria. Laravel/Angular do PDF antigo é histórico. Se código divergir, documente AS-IS versus alvo; não migre código nesta tarefa.
6. Preserve tenancy como direção proposta posterior, auth segregada fora da sandbox, tools via broker, um executor/um writer, assinaturas primeiro, sem API/extras/fallback/autorecharge. Nenhum documento comprova eficácia sem teste. CLI sem ponte suportada permanece incompatível, sem contorno de OAuth/API/auth mount.
7. Trate divergências de rota POST runs, estados PAUSED_BUDGET/BLOCKED versus PAUSED_RESOURCE/BLOCKED_RECOVERY, FAC-002 versus gates LF-MT, ADRs ausentes/IDs propostos, índices quebrados, orçamento/retention/estimates e fontes vencidas. Resolver pelo código/decisão autorizada pertinente; incerteza vai a pendências com evidência. Não aceitar “mais recente” automaticamente se só proposta.

## Fase 3 — migração concreta

8. Integrar docs/README Manual Vivo com visão rápida, problema/fluxo/stack/módulos/limites/trilhas. Criar LEIA-ME-PRIMEIRO e glossário canônico.
9. C4 em Mermaid com níveis explícitos e canais corretos; monólito modular pode ter vários componentes, não exigir microserviços. Outbox no banco, Redis é fila/cache. Broker/sandbox não acessam controle/auth.
10. Para cada módulo real ou planejado, documente finalidade/limites/regras/fluxos/estados/dados/integrações/contratos/falhas/segurança/ADRs/features/código e evidência. Não invente `src/modules` ou classes ausentes. Comece com README preenchido e separe capítulos só quando necessário.
11. Features são comportamento, entregas são história; preserve IDs FAC/LF-MT. Contratos têm auth/request/response/erro/efeitos/idempotência/versão/consumidores/exemplos/testes; se faltam schemas, marque pendência. Fonte de código/schema real prevalece para implementação, diferenças de intenção são registradas.
12. ADRs preservam número/status/decisão original; mudanças criam substituição ou proposta claramente identificada, nunca reescrita histórica silenciosa. Recuperar capítulos do PDF com páginas/origem. Consolidar operação/handoff/economia/backup/restore/observabilidade e desenvolvimento/piloto/plano/testes sem perder detalhes.
13. Realocar relatos existentes a docs/09-entregas/<ano>; lessons efetivamente aplicadas a docs/10-lessons, preservando exemplos/revisões/links. Sem lesson real, índice declara ausência; não inventar. Histórico append-only com errata identificada.
14. Guias AGENTS/CLAUDE/ANTIGRAVITY de raiz e ponte .agents/rules apontam uma única política docs/00-governanca; preservar partes específicas/locais. Eliminar regras correntes concorrentes de criação em documentacoes; antigos caminhos viram bridges após preservar conteúdo. Atualizar prompts/gate realmente afetados. Não garantir descoberta automática sem teste da versão.
15. Índices/atalhos/changelog/backlog/matriz devem ter fonte única. Copiar pacote de planejamento por cima do backlog real é proibido. Preservar conteúdo local extra antes de consolidar. Arquivo duplicado só vira atalho após fonte canônica completa e mapa fechado.

## Fase 4 — verificação e entrega

16. Rodar validador documental; links/anchors/fences e hashes devem passar. Ajustar manifesto e mapa ao repo real, mantendo manifesto original do pacote como histórico. Não modificar snapshots para apagar conflito. Revisar Mermaid/tabelas/manuais e verificar cobertura por seção.
17. Conferir semanticamente docs versus código/ADRs, estado planejado/implementado/verificado e cronologia. Checks de software apenas se alteração de gate/config exige, usando comandos reais do repo; sem teste executado inventado.
18. Testar leitura com nova sessão de cada agente quando disponível; fonte/paths reconhecidos e políticas abertas. Caso indisponível, registrar NÃO VERIFICADO e instrução explícita de fallback. Não ampliar permissões para testar autoload.
19. Criar entrega documental com objetivo/funcionamento/origem/diff/revisão/checks/risco/limitações/rollback/lessons pertinentes/aceite. Atualizar changelog/backlog da migração sem marcar software DONE. Final deve dizer o que migrou, onde estão guias/prompt, conflitos resolvidos, pendências e verificações reais.

## Critérios de conclusão

Cada entrada e seção tem destino canônico ou justificativa histórica; originais íntegros/hash; atual não contradiz stack/dados/fluxos comprovados; módulos/contratos navegáveis; uma política comum carregável ou fallback explícito; templates completos; históricos preservados; links correntes e revisão semântica aprovados. Se contexto acabar, guardar checkpoint/mapa/progressos/pendências e continuar sem refazer migração inteira. Sem acesso ao código, conclua o material disponível e declare limite; não pare somente por falta de evidência de implementação.

Merge/deploy/publicação e migrações irreversíveis seguem autorização aplicável já existente. Não pedir confirmações repetidas para edição reversível dentro do escopo; dúvidas materiais podem ser registradas enquanto o trabalho independente continua.
