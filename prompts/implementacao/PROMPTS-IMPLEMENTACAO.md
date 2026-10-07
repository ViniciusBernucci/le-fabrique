# Prompts de implementação — 11 etapas

Data: 2026-10-06. Todos os trabalhos abaixo: **PLANEJADOS**. Cada seção é um prompt completo que pode ser copiado isoladamente. Primeiro executar [preparação](PROMPT-00-PREPARACAO.md). Dependências são gates com evidência, não apenas tickets com arquivos presentes. O agente não deve implementar as onze etapas numa única sessão.

---

# Prompt 01 — LF-MT-01: Identidade tenant/projeto e autorização

## Objetivo

Implemente incrementalmente identidade tenant/projeto e autorização na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-00; inventário de auth/dados e baseline; FAC-003 pode ser bootstrap se nenhum código existir. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/03-modulos/tenant-isolation/00-README.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/06-decisoes/ADR-003-multi-tenant-e-stack.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Criar Tenant/Membership/ProjectGrant e contexto autenticado no NestJS; cadeia de propriedade e DTOs; React seleciona tenant/projeto com validação no servidor; listar entidades/rotas privadas e corrigir IDs cruzados.

## Fora de escopo

Sandbox, provider, billing e provisionamento; não habilitar dispatch de IA.

## Requisitos técnicos

Membership server-side; grants de projeto; IDs opacos; FKs compostas planejadas coordenadas com etapa 02; resposta sem revelar existência; revogação revalidada; nenhuma autoridade de prompt/header livre.

## Critérios de aceite e testes de segurança negativos

SEC-01/02 em rotas reais e websocket quando existente, leitura/escrita/listagem; positivo de projeto autorizado; inventário de cobertura sem rotas esquecidas. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 02 — LF-MT-02: Persistência RLS, filas e caches

## Objetivo

Implemente incrementalmente persistência rls, filas e caches na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-01 aceito; schema/migrations/backup de teste identificados. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/03-modulos/tenant-isolation/00-README.md, docs/05-contratos/schemas/job-package.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Criar migrations graduais tenant_id/FKs/índices, políticas RLS em entidades privadas; scoped transaction no ORM real; outbox/filas/cache/artefatos indexados por escopo.

## Fora de escopo

Integração real de IA, redes/sandbox e migração irreversível de produção.

## Requisitos técnicos

USING/WITH CHECK + FORCE; app sem owner/superuser/BYPASSRLS; SET LOCAL no mesmo transaction/pool; migrations com papel separado; órfãos em quarentena; Redis ACL por serviço e envelope revalidado; nunca SQL do modelo.

## Critérios de aceite e testes de segurança negativos

SEC-03/04 em PostgreSQL/Redis reais de teste; INSERT/UPDATE cruzados e consulta sem filtro, rollback e pool A/B; plano de migration e restore demonstrados. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 03 — LF-MT-03: JobPackage e contexto mínimo

## Objetivo

Implemente incrementalmente jobpackage e contexto mínimo na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-01/02 aceitos; projeto/revisão fixture e Context Builder inventariados. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/07-operacao/02-execucao-e-recuperacao.md, docs/03-modulos/sandbox/README.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Construir pacote imutável por tenant/project/run/attempt com hashes de fontes/policy/revisão, omissões e limites; exportar snapshot independente sem segredos ou .git do host.

## Fora de escopo

Resumo de toda a fábrica para IA, embeddings globais, runtime real e auth de fornecedores.

## Requisitos técnicos

Identidade somente do controle; excluir auth/.env/DSN/tokens; sem parent mounts/alternates/hooks; separar instruções confiáveis de dados do repo; recusar path/symlink malicioso; contexto privado não usa cache global.

## Critérios de aceite e testes de segurança negativos

SEC-02/06 e scan de canários; JobPackage A1 contém só A1; replay pacote B rejeitado; hash/truncamento registrados; nenhuma instrução do repo muda policy. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 04 — LF-MT-04: Instalações, credenciais e identidades Linux

## Objetivo

Implemente incrementalmente instalações, credenciais e identidades linux na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-01/02/03 aceitos; ambiente de ensaio Linux autorizado; mecanismo oficial ainda por validar. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/03-modulos/runtime/00-README.md, docs/07-operacao/infraestrutura/00-dimensionamento-vps.md, docs/06-decisoes/ADR-004-provider-runtime-sem-segredos-no-sandbox.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Criar catálogo tenant-scoped, CredentialResolver/Store de referências opacas, isolamento UID/HOME por tenant/provider e sessão por attempt; onboarding/revoke/rotation sem token no controle.

## Fora de escopo

Coletar senha/OAuth via API, reutilizar token em SDK, copiar sessão, ligar provider ou alterar planos/gastos.

## Requisitos técnicos

Resolver tenant→project→run→installation→credential com FK/rechecagem; auth oficial fora sandbox; UID/GID/ACL/LSM distintos, sem home global; env allowlist; credencial worker separada; capability/preflight ligado à generation; providers DISABLED até etapa 08.

## Critérios de aceite e testes de segurança negativos

SEC-05/13 com credenciais fictícias e UIDs reais; instalação B não resolve para A; home/proc/env/artefatos não vazam; revogar impede nova resolução; teste de login real opt-in apenas no fluxo suportado. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 05 — LF-MT-05: Executor e sandbox efêmero

## Objetivo

Implemente incrementalmente executor e sandbox efêmero na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-03/04 aceitos; runtime Linux e perfil escolhido; auth permanece fora. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/03-modulos/sandbox/00-README.md, docs/07-operacao/infraestrutura/00-dimensionamento-vps.md, docs/06-decisoes/ADR-005-sandbox-efemero-e-perfil-de-isolamento.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Implementar helper lifecycle com perfis fixos e sandbox por attempt; namespaces/rootfs/mounts/cgroups, serviços sintéticos por attempt, coleta após quiescência e cleanup idempotente.

## Fora de escopo

Docker acessível à IA, produção arbitrária de terceiros, paralelismo e egress livre; não exigir segunda VPS.

## Requisitos técnicos

Sem privileged/socket/home/proc host; não root, drop caps, no-new-privileges, seccomp/LSM; imagens por digest; rede inicial none; nenhuma flag de host vinda do modelo; um executor; resource quotas agregadas.

## Critérios de aceite e testes de segurança negativos

SEC-06/11 com shell hostil direto no sandbox; verificar mounts/UID/cgroup/PIDs; filhos morrem no timeout; novo ambiente não herda state; falha de perfil impede READY. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 06 — LF-MT-06: Rede e dependências com egress controlado

## Objetivo

Implemente incrementalmente rede e dependências com egress controlado na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-05 aceito com network none; endpoints reais e interfaces inventariados. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/02-arquitetura/seguranca/01-rede-e-egress.md, docs/07-operacao/infraestrutura/dimensionamento-vps.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Aplicar matriz de fluxos no host/namespaces, proxy/fetch de dependências por operações limitadas; separar inferência, build e controle; instrumentar denies e health fail-closed.

## Fora de escopo

Internet aberta por domínio amplo, compra de infra, dependências privadas com token global e browser sem perfil.

## Requisitos técnicos

Firewall efetivo IPv4/IPv6/forwarding; bloquear DB/Redis/API pública e interna/metadata/daemon/lateral; DNS/IP efetivo/redirect revalidado; sem CONNECT genérico/UDP livre; preferir lockfile fetch sem executar scripts no fetcher; deny sem política/proxy.

## Critérios de aceite e testes de segurança negativos

SEC-07/08 positivos/negativos com canários no destino, rebinding e IPv6; repetir após reboot/criação de container; npm permitido só pelo mecanismo aprovado, sem uploads/URL arbitrária. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 07 — LF-MT-07: Broker e capabilities temporárias

## Objetivo

Implemente incrementalmente broker e capabilities temporárias na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-03/05/06 aceitos; manifesto e canal autenticado definidos. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/03-modulos/tool-broker/00-README.md, docs/06-decisoes/ADR-006-rls-capabilities-e-egress.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Implementar catálogo estreito de leitura/busca/patch/diff/check/artifact, broker por attempt sem acesso ao controle, emissão/verificação/revoke e channel binding de capability.

## Fora de escopo

Shell/HTTP/SQL host genéricos, administração de provider, tokens de controle/Git amplos e relaxar deny para corrigir tool error.

## Requisitos técnicos

Tenant do canal, TTL ≤ lease/deadline, audience/jti/fencing/policy/revoke em cada operação; caminhos por descritor e TOCTOU seguro; schemas/argv/stdin fixos; check roda só sandbox; reviewer não escreve; keys issuer não montadas.

## Critérios de aceite e testes de segurança negativos

SEC-06/09: replay, TTL, revoke, audience, outro canal/tenant, stale fence, path race, profile desconhecido; afirmar ausência de efeito no destino; positivo de check autorizado. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 08 — LF-MT-08: Adapters oficiais e preflight do Provider Runtime

## Objetivo

Implemente incrementalmente adapters oficiais e preflight do provider runtime na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-04/05/06/07 aceitos; provider específico escolhido e modo elegível a verificar. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/03-modulos/runtime/00-README.md, docs/02-arquitetura/seguranca/00-threat-model.md, docs/08-desenvolvimento/testes-seguranca.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Implementar primeiro adapter oficial isolado, depois validar Codex/Claude/Antigravity separadamente; execute/events/cancel/capabilities/usage unknown; provar ponte suportada para ferramentas remotas.

## Fora de escopo

Modificar cliente oficial, OAuth para SDK, auth no sandbox, API paga, mudanças de assinatura; não declarar todos compatíveis por um preflight.

## Requisitos técnicos

Confirmar versão/--help/origem/login/billing do cliente; processo autenticado sem shell/hooks/plugins/MCP local livres; tools exclusivamente broker; nunca fingir que JSONL é interceptação; UNSUPPORTED_ISOLATION bloqueia; subscription-only com API keys herdadas bloqueadas e extras off; versão/config nova invalida preflight.

## Critérios de aceite e testes de segurança negativos

SEC-05/10/13 por provider/versão; repository config tenta shell local, ler auth e tool bypass; cliente oficial só acessa sua auth; cancel árvore real; modelo/uso só com evidência. Mock não habilita AVAILABLE. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 09 — LF-MT-09: Workflow, handoff, fencing e artefatos

## Objetivo

Implemente incrementalmente workflow, handoff, fencing e artefatos na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-01–08 aceitos para ao menos um provider ou fixture sem liberação real; checkpoint/storage escopados. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/07-operacao/02-execucao-e-recuperacao.md, docs/03-modulos/sandbox/00-README.md, docs/05-contratos/schemas/job-package.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Integrar pipeline tenant-scoped, outbox/claim idempotente/leases, pause/cancel/recovery, snapshot patch+untracked, restore em nova attempt e handoff dentro do tenant.

## Fora de escopo

Novo workflow engine, múltiplos writers, merge/deploy automático, retry infinito e migração de sessão de fornecedor.

## Requisitos técnicos

Um writer comprovado; revogar tools antes de parar, quiescência ou BLOCKED_RECOVERY; eventos stale rejeitados; hash/ownership antes de restore; arquivo/coleta não confiável validado; não repetir RESULT_UNKNOWN automaticamente; nunca transferir auth/sessão privada.

## Critérios de aceite e testes de segurança negativos

SEC-04/11/12; crash/reboot/partição, filho escritor, envelope forjado e duplicate dispatch; patch/untracked restaurados sem side effects/links externos; outro tenant não recebe checkpoint. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 10 — LF-MT-10: Defesa contra injection, auditoria e gate por revisão

## Objetivo

Implemente incrementalmente defesa contra injection, auditoria e gate por revisão na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-01–09 aceitos em ensaio; pipeline/checks da revisão disponíveis. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/02-arquitetura/seguranca/00-threat-model.md, docs/08-desenvolvimento/12-testes-seguranca.md, docs/00-governanca/POLITICA-IA.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Adicionar suite adversarial com ataques diretos e via modelo, auditoria por tenant, sanitização/UI escape, sessão reviewer separada e gate documental/aceite associado à revisão/config.

## Fora de escopo

Prometer detector infalível, declarar zero vulnerabilidades, enviar logs internos ao modelo e criar lessons sem aplicação real.

## Requisitos técnicos

Nenhuma mensagem de IA muda status DONE/tenant/provider/policy/gasto; outputs e archives validados; logs sem tokens/PII; novas revisões invalidam approvals; provenance/omissões/instruction hashes; scanners são auxiliares, enforcement externo.

## Critérios de aceite e testes de segurança negativos

SEC-01/02/10/12/13; injection bem-sucedida seguida de tools negadas; XSS/log forging; aprovação de SHA antigo negada; relatório sem evidência rejeitado; cache/sessão A não vaza a B/A2. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


---

# Prompt 11 — LF-MT-11: Hardening operacional e liberação por gates

## Objetivo

Implemente incrementalmente hardening operacional e liberação por gates na arquitetura multi-tenant do Le Fabrique, mantendo a etapa desligada para uso real até os gates pertinentes passarem.

## Pré-condições

LF-MT-01–10 aceitos; ambiente de ensaio autorizado, specs da VPS e perfil real conhecidos. Confirme essas condições com evidência antes de habilitar caminhos de execução; ausência não autoriza bypass.

## Documentos e código a ler

docs/07-operacao/infraestrutura/00-dimensionamento-vps.md, docs/07-operacao/02-execucao-e-recuperacao.md, docs/08-desenvolvimento/12-testes-seguranca.md, docs/08-desenvolvimento/plano-mvp.md. Inspecione também código de auth/controllers/services/repositories, migrations, worker, adapters, testes, configuração e CI que sejam afetados; determine os caminhos reais antes de editar.

## Escopo

Executar suite Linux completa, reserva de recursos/admission, kill switch global/tenant, backup/restore e incident runbook; documentar prontidão de piloto versus tenants hostis e trilha de perfil forte.

## Fora de escopo

Compra/segunda VPS, HA, liberação comercial automática, habilitar créditos/API, deploy/merge sem autorização e reduzir isolamento para caber no envelope.

## Requisitos técnicos

Um executor inicial, quotas runtime+browser+auxiliares; rollback seguro preserva barreiras; RPO/RTO medidos/unknown; nenhum segredo real em evidência; perfil container só próprio/sintético; avaliar gVisor/microVM compatível na mesma VPS antes de código hostil.

## Critérios de aceite e testes de segurança negativos

SEC-01–14 aplicáveis na revisão final/config exata; SEC-14 sob carga e restore; repetir após reboot; medir API/OOM/disco; resultados NOT_RUN bloqueiam o gate relevante; fornecer decisão de admissão e limitações. Consulte os procedimentos SEC em docs/08-desenvolvimento/testes-seguranca.md. Os IDs são requisitos de teste; não declare que foram executados até produzir evidência real.

## Instruções obrigatórias deste prompt

Preserve React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e VPS Linux única; um executor inicial e um writer por workspace. Clientes oficiais/assinaturas primeiro; API, fallback pago, extra usage e autorecharge desligados. IA, código, repo, web e resultados são potencialmente hostis. Credenciais de IA nunca entram em sandbox, contexto, logs ou artefatos. Nenhuma ação do modelo alcança DB/Redis/API interna/segredos/daemon/outro tenant. Políticas são impostas por software/OS/rede fora do modelo, deny-by-default e fail-closed. Não prometer isolamento absoluto contra comprometimento de host/kernel compartilhado.

Inspecione o repositório e o ambiente reais antes de editar; leia AGENTS.md e regras locais do provider, README.md, docs/08-desenvolvimento/07-piloto.md, docs/08-desenvolvimento/09-backlog.md, docs/08-desenvolvimento/10-plano-mvp.md, docs/05-contratos/00-README.md e docs/05-contratos/schemas/04-job-package.md, docs/08-desenvolvimento/05-matriz-cobertura.md, docs/02-INDEX.md e docs/00-governanca/POLITICA-IA.md. Preserve regras locais, arquivos existentes e materiais sources/ read-only. Os paths deste prompt são do pacote proposto; mapeie-os à árvore real e registre divergências. Se só houver planejamento, não invente módulos já existentes: implemente bootstrap mínimo no ticket READY ou registre pré-condição ausente. Registre branch/worktree, base/code SHA real e baseline; preserve mudanças prévias. Execute somente esta etapa, em incremento revisável. Não contratar/deploy/merge/migrar produção de modo irreversível sem autorização aplicável.

## Documentação, evidência e handoff obrigatórios

Rode checks adequados na revisão final e os negativos exigidos com tenants/projetos/canários sintéticos, incluindo controle positivo. Registre comando/procedimento, revisão/config/policy/image/CLI/kernel reais, resultado observado e ausência de efeito no alvo. Teste mock não comprova isolamento Linux nem compatibilidade do cliente oficial. Até duas rodadas de correção; depois checkpoint/diagnóstico sem relaxar fronteira. Não registrar segredo/token/dump/PII.

Entregue diff/patch sanitizado, arquivos untracked recuperáveis, relatório docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md com funcionamento/contratos/erros/testes reais/limitações/rollback; atualize README do módulo, ADRs/API/operação afetados, docs/02-INDEX.md, docs/04-CHANGELOG.md, docs/08-desenvolvimento/09-backlog.md e docs/08-desenvolvimento/matriz-cobertura.md. Lessons só com conceito efetivamente aplicado, exemplo real e índice atualizado. Handoff contém tenant/project/run/attempt quando reais, base/code SHA, hashes, policy, fencing e confirmação externa de writer parado; testes não executados e próximos passos explícitos. Não invente IDs ou hashes como evidência.

Marque por controle IMPLEMENTADO somente com código/config real e evidência vinculada; PLANEJADO quando especificado; NÃO VERIFICADO quando eficácia não foi testada. Não alegue sucesso por exit code zero, resposta do modelo, presença de MD ou um teste positivo. DONE somente após aceite humano da revisão exata. Se faltar acesso/compatibilidade/evidência, entregue o incremento possível e mantenha gate/provider bloqueado, sem simular implementação.


## Regra documental atualizada

[Política canônica](../../docs/00-governanca/01-POLITICA-IA.md) rege estado atual + registro de entrega + lessons pertinentes. Os caminhos antigos sobrevivem somente no histórico. O gate documental deve usar docs/09-entregas, não exigir documento novo em documentacoes/.


## Origem desta edição

[Versão original preservada](../../docs/99-historico/originais/output/le-fabrique-multitenant/prompts/PROMPTS-IMPLEMENTACAO.md). Migração editorial de paths em 2026-10-06; conteúdo de engenharia continua proposto.
