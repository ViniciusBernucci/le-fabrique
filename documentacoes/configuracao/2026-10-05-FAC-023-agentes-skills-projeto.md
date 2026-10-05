# FAC-023 — Agentes e skills por projeto
Data: 2026-10-05. Estado: IMPLEMENTADO / AWAITING_HUMAN.
Baseline: 30fbd91; revisão de código: `a25638acde42ba50576908f1bf6725570a360a99`. Branch feat/fac-023-agents-skills, worktree isolada /home/vinicius/le-fabrique-fac-023.

## Objetivo e escopo
Pedidos do responsável: Equipes deve permitir quantos agentes forem necessários e separar Agentes/Skills; precisa existir um lugar para registrar as skills do projeto. [Ticket READY](FAC-023-agentes-skills.md). Stack aprovada preservada, mesmo writer, sem subagentes/handoff. Merge em developer e limpeza pós-merge autorizados no fluxo da sessão.

## Funcionamento
Em Configurações → Equipes há abas Agentes e Skills. Agentes possui cadastro, edição e exclusão, nome, descrição, instruções, projeto opcional, conta/modelo opcionais, ativação do cadastro e seleção das skills do mesmo projeto. A coleção não tem limite fixo de seis: o browser criou oito e o contrato testou 25.

Skills exige projeto, nome e instruções; descrição é opcional. O seletor lista somente registros do projeto escolhido. Criar/editar/excluir salva imediatamente pelo PUT versionado de settings, com retorno da API substituindo o estado local. Cancelar descarta o rascunho; falha mantém modal e erro visível. Sem projeto, registrar skill fica indisponível e a tela orienta cadastrar um em Projetos.

Excluir skill remove seus vínculos dos agentes. Mudar o projeto da skill remove vínculos incompatíveis; mudar o projeto do agente limpa seleção anterior. Remover/desabilitar conta ou retirar modelo limpa os alvos inválidos dos cadastros. As seis atribuições operacionais existentes ficam em Funções de execução da fábrica, dentro da aba Agentes, preservando seus modais, permissões, budgets e alternativas.

## Contratos e persistência
`projectSkills` e `digitalAgents` são coleções opcionais aditivas no JSON de FactorySettings; configuração antiga continua válida, sem migration, novo endpoint ou dependência. Objetos estritos validam UUID, nomes, instruções, IDs únicos, par conta/modelo e catálogo da instalação habilitada. Referência a skill precisa existir, ser única no agente e pertencer ao mesmo projeto. API valida projetos existentes na transação antes do update condicional por expectedVersion; conflito não sobrescreve outra revisão. GET administrativo e snapshot interno passam pelo mesmo contrato.

Nome até 100 caracteres, descrição até 500, instruções da skill até 64.000 e do agente até 16.000. Sem teto numérico nas coleções; o envelope HTTP global continua limitado a 8 MiB + 4 KiB, portanto não há promessa de armazenamento infinito. Registro é agrupado por projeto no JSON global existente, não na definição compilada do projeto.

## Limitações explícitas
Cadastro de agentes/skills organiza perfis e instruções. Não instala SKILL.md no cliente oficial, não injeta instruções automaticamente no contexto de execução e não cria execução paralela. O router continua consumindo as seis funções operacionais configuradas. Cadastro ativo não significa provider disponível/autenticado. Nada habilita API paga, extras, fallback ou novo writer. Browser usa HTTP fixtures com credencial sintética; persistência real é implementada via Prisma no singleton existente e testada com transação mock, sem ensaio PostgreSQL de escrita nesta entrega. Nenhum provider/login foi executado, credencial lida ou banco migrado.

## Checks e evidências
Typecheck completo e build completo: PASS. Vite 8.3.1, 134 módulos. Lint: PASS, 256 arquivos e um aviso useOptionalChain preexistente em run-delivery.service.ts:209. Testes: contratos 51, API 185, web 46, runtime 65, worker 215, todos PASS (562). Baseline API tinha 183 testes PASS; os dois novos verificam persistência de 12 agentes/skill e rejeição de projeto inexistente antes de escrita.

Browser Chromium/Playwright: criação/edição de skills por projeto, oito agentes, associação, recarga via GET, exclusão e limpeza de referências, conflito 409 com rascunho preservado, abas por teclado, template persistente e modal 16px. Sem overflow em 1536/1024/768/390/320px, sem pageerror. Capturas desktop/modal/mobile inspecionadas. 14 PUTs exclusivamente em fixture local; nenhuma requisição real ao banco/provider. [Resultados](evidencias/FAC-023/browser-results.txt), [script reproduzível](evidencias/FAC-023/browser-check.mjs), [skills](evidencias/FAC-023/skills-desktop.png), [agentes](evidencias/FAC-023/agents-desktop.png), [modal skill](evidencias/FAC-023/skill-modal.png), [mobile](evidencias/FAC-023/agents-mobile.png), [modal mobile](evidencias/FAC-023/agent-modal-mobile.png), [checks](evidencias/FAC-023/checks.txt).

Baseline operacional: dependências isoladas copiadas por hardlink de node_modules, com links de workspace relativos à worktree. Primeiro ensaio API falhou por ausência de @prisma/client na cópia; corrigido o layout de dependências aninhadas sem alteração do código/banco. Browser inicialmente comparava nós DOM capturados antes de recarregar a página; harness corrigido para capturar após recarga, sem alteração da aplicação. Nenhuma rodada corretiva de implementação necessária. Não confundir essas falhas de ambiente/harness com regressão.

## Diff, documentação e lessons
[Patch sanitizado, contexto zero](evidencias/FAC-023/implementation.patch), baseline→revisão acima. Sem valores privados. README raiz e dos domínios configuração/controle/runtime, INDEX, CHANGELOG, BACKLOG e ticket atualizados. Lessons de [contratos](../../lessons/contratos-runtime-monorepo.md) e [modais](../../lessons/modal-edicao-configuracao.md) ampliadas com vínculos e limpeza referencial. Não há alteração de stack/ADR, API de rota ou infraestrutura.

## Rollback
Antes de reverter a implementação, preservar os cadastros de agentes/skills com export autorizado e remover os campos novos do JSON por atualização versionada compatível; o schema estrito anterior rejeita os campos novos. Depois reverter o commit de código acima. Sem migration para desfazer. Não executar rollback destrutivo nem apagar cadastros automaticamente; procedimento descrito, não realizado.

## Uso de IA e aceite
Codex da sessão; modelo efetivo, cota e custos não comprovados. Zero clientes adicionais, subagentes e handoffs. Merge autorizado não representa aceite funcional/visual. AWAITING_HUMAN; DONE somente após aceite da revisão exata. Sem push/deploy/produção.
