# Operação da fábrica e worker

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

## Inicialização
Durante a construção, confirmar políticas e usar somente fixtures sintéticas; instalar clientes de fontes oficiais com versões registradas; login humano nos clientes; verificar extras desligados nas contas; executar preflight; registrar worker com credencial própria de escopo mínimo e validade/rotação. Confirmar o contrato do piloto real antes do FAC-012. Deploy do controle é uma tarefa futura autorizada separadamente.

FAC-002 comprovou o Codex CLI 0.159.2 no usuario atual da VPS, com autenticacao ChatGPT, chaves de API ausentes e comandos confinados a fixtures. O teste financeiro continua humano: verificar em Settings > Usage que creditos e recarga automatica nao serao usados. O FAC-005 deve repetir a prova sob a identidade de servico que executara o adapter.

FAC-005 implementou o adapter como biblioteca do `packages/runtime`: processo sem shell, prompt por stdin, ambiente sem chaves de API, eventos sanitizados, limite de logs, timeout e cancelamento do grupo. O loop BullMQ atual continua somente com o probe; ativar execucao de tickets antes de claim/lease/fencing permanece proibido.

FAC-006 adicionou Context Builder e RuntimeGuard como bibliotecas locais. O manifesto registra fontes, hashes, omissoes e revisao-base; qualquer omissao sinaliza truncamento. O guard deve autorizar a tentativa antes do adapter e seu estado precisa ser persistido pela futura orquestracao. O sanitizador comum remove nomes conhecidos de API key, mas a identidade de servico e o sandbox ainda precisam provar que o codigo executado nao alcanca o armazenamento oficial de login.

FAC-007 implementa o limite de execucao local: supervisor cria worktree e snapshot fora do namespace; comandos rodam em unidade systemd transiente, cgroup e namespaces sem home, `/run`, Docker socket ou rede externa. Timeout mata o cgroup e exige confirmacao. O host precisa passar preflight de systemd de usuario, user namespaces, mount e `prlimit`; falha de qualquer capacidade bloqueia jobs. O loop BullMQ ainda nao chama esses componentes.

FAC-008 implementa o dispatcher outbox/BullMQ, o protocolo interno de claim, renovacao, checkpoint e conclusao e um consumidor de `le-fabrique.execution` limitado ao probe sintetico. Run e attempt persistem lease e fencing monotono; reentrega durante a janela entre checkpoint e conclusao reutiliza o attempt parado, e lease vencido sem parada confirmada bloqueia recuperacao. O job carrega a revisao-base somente quando `baseRef` ja e um SHA de 40 caracteres; sem essa evidencia o probe falha antes do claim. FAC-009 implementa a composicao local, ainda sem ativar o consumer real.

FAC-009 implementa `DeveloperWorkflow` como coordenador injetavel no worker. Ele cria worktree na revisao exata, constroi contexto, mede baseline, autoriza chamadas pelo guard, executa Developer com escrita, checks argv confiaveis no sandbox, snapshot e Reviewer em execucao separada somente leitura. Falha preexistente e registrada separadamente; regressao nova bloqueia aprovacao. Check sem parada confirmada encerra o fluxo antes de iniciar writer ou capturar snapshot.

O coordenador ainda nao substitui o probe BullMQ: falta um perfil local confiavel que associe projeto a repositorio clonado e comandos permitidos. Ativar antes disso exigiria aceitar caminho/comando do controle sem allowlist. O FAC-010 pode reutilizar o resultado e snapshots, mas nao deve contornar esse gate.

FAC-010 esta WAITING_PROVIDER. Claude Code e Antigravity estao instalados, mas deslogados; o worker nao deve tentar login, copiar credenciais ou cair para API. Sem segundo provider elegivel, preservar snapshots/checkpoints e aguardar intervencao humana.

FAC-011 implementa o Centro de Configuracoes antes da retomada do FAC-010. O operador pode preparar contas, modelos, atribuicoes por funcao e metadados GitHub no painel, mas salvar nao executa login ou provider. O worker confiavel ainda precisa reconciliar o estado desejado com binario, identidade e autenticacao reais. Dados de login permanecem no armazenamento oficial do cliente e nunca no browser/tabela `factory_settings`.
VPS roda proxy HTTPS, frontend, API, scheduler, PostgreSQL e Redis privados. Supervisor interno roda como usuário dedicado e usa protocolo interno autenticado. Manter credencial da fábrica separada de credenciais dos providers. Não expor endpoint local ou montar diretórios pessoais nos worktrees.
Sandbox sem privileged, socket Docker, home completo, banco/Redis da fábrica, credenciais de Git amplas ou dados reais. Supervisor confiável prepara checkout e serviços sintéticos. Credenciais de provider inevitavelmente acessíveis ao cliente exigem isolamento de identidade/armazenamento; código executado não deve conseguir lê-las. Validar por teste de acesso negado, não só instrução escrita.
## Worker API
Implementado no FAC-004: `POST /internal/workers/register`, `POST /internal/workers/{id}/heartbeat` e `GET /workers` administrativo. O protocolo interno usa `WORKER_API_TOKEN`, não aceita a credencial administrativa e é bloqueado pelo Nginx público. O worker encerra após três heartbeats consecutivos com falha.

Implementado no FAC-008: claim, renovacao, checkpoint e complete com payloads versionados e autenticacao interna. Claim e transacional; todas as mutacoes exigem fencing token atual. Checkpoint aceita somente revisoes e hashes validados pelos contratos. Eventos detalhados e armazenamento ampliado de artefatos permanecem futuros.
Worker não escolhe arbitrariamente repo, comando ou URL fornecidos em output de IA. Controle só distribui jobs de projetos cadastrados; valida repo/ref e perfis de comando. Eventos/logs são sanitizados e limitados antes de armazenar/exibir.

## Controle administrativo atual

FAC-003 protege `GET /auth/session`, projetos e tickets com `Authorization: Bearer`. O valor de `ADMIN_API_TOKEN` tem no mínimo 32 caracteres, fica somente no ambiente da API e nunca deve entrar no bundle, banco ou logs. O painel conserva a credencial em `sessionStorage`, portanto a implantação exige HTTPS e uma origem web confiável; identidade multiusuário, expiração e revogação granular continuam futuras.

O operador pode criar/listar projetos, criar/listar tickets, promover `DRAFT` para `READY` e editar o Centro de Configuracoes. A promoção exige `expectedVersion`, incrementa a versão e cria `ticket.ready.v1` na mesma transação. Configuracoes tambem usam versao otimista, mas nao geram execucao ou outbox neste incremento. `deduplication_key` único torna retries de READY idempotentes.
## Recuperação
Queda do worker: parar agendamento local, manter painel, esperar heartbeat; preservar checkpoints. Internet caiu: parar execução antes de lease expirar. Auth expirada: AUTH_REQUIRED; usuário faz login oficial local. Cota acabou: handoff seguro ou WAITING_PROVIDER. Disco cheio/OOM: PAUSED_RESOURCE, limpar somente workspaces já preservados. CLI mudou schema: bloquear adapter, testar fixture e integrar atualização em ticket próprio.
Kill switch bloqueia claims, solicita cancelamento e monitora fim das árvores de processos; nunca declarar cancelado sem evidência. Supervisor aplica timeout e limites de logs/disco, além de CPU/RAM.
## Backup e restauração
Restaurar PostgreSQL numa instância de teste; conferir tickets e versões; recuperar artefatos por hash; buscar Git/revisão; renovar credencial do worker sem restaurar tokens de provider por cópia informal. Testar cenário com execução interrompida. Registrar tempo real/RPO efetivo e lacunas.
## Observabilidade
Fila/etapa, last heartbeat, lease, processos, CPU/RAM/disco, OOM, duração, provider/modelo/versão, uso conhecido/desconhecido, handoffs, retries, checks/docs e revisão aceita. Evitar prompts completos e segredos nos logs. Browser de QA com perfil efêmero sem sessão pessoal.
## Evolução
Separar execução em outra VPS é alternativa futura, sujeita a métricas e revisão de isolamento. APIs podem prover capacidade com orçamento; execução na VPS não elimina termos dos fornecedores. Código de terceiros exige isolamento mais forte que containers compartilhando host.

## Provisionamento da VPS única no MVP
Selecionar perfil em infraestrutura/DIMENSIONAMENTO-VPS.md e registrar especificações reais. Configurar firewall: HTTPS público; SSH administrativo restrito; Redis/PostgreSQL/worker privados. Separar volumes persistentes de temporários. Instalar supervisor como serviço com usuário dedicado e recuperação após reinício.
Fazer login oficial pelo método suportado para servidor sem interface; callback/fluxo remoto apenas conforme documentação do cliente. Não desabilitar autenticação nem copiar cookies. Confirmar credenciais acessíveis ao cliente e inacessíveis a código/testes/logs.
Rodar baseline no mesmo ambiente que executará jobs. Medir recursos e painel durante build. Reiniciar worker, depois VPS em janela de teste; comprovar leases, nenhuma duplicação e retomada de checkpoint. Validar backup externo e restauração. Não abrir banco/fila para facilitar diagnóstico.

## Bootstrap executável atual

FAC-000 implementa a fundação local. `compose.dev.yaml` publica PostgreSQL e Redis apenas no loopback para desenvolvimento. A composição completa publica somente o Nginx na porta 8080; API, worker, PostgreSQL e Redis ficam na rede interna. A API aplica migrations com `prisma migrate deploy` e expõe liveness e readiness. FAC-004 registra o worker com UUID/capacidades e mantém heartbeat persistido, com concorrência global igual a 1. FAC-008 publica jobs de ticket e o loop principal processa somente o probe sintetico de orquestracao. FAC-009 fornece o coordenador executavel, ainda nao ativado no loop sem perfil local confiavel.
