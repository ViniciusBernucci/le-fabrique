# Operação da fábrica e worker

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

## Inicialização
Durante a construção, confirmar políticas e usar somente fixtures sintéticas; instalar clientes de fontes oficiais com versões registradas; login humano nos clientes; verificar extras desligados nas contas; executar preflight; registrar worker com credencial própria de escopo mínimo e validade/rotação. Confirmar o contrato do piloto real antes do FAC-012. Deploy do controle é uma tarefa futura autorizada separadamente.
VPS roda proxy HTTPS, frontend, API, scheduler, PostgreSQL e Redis privados. Supervisor interno roda como usuário dedicado e usa protocolo interno autenticado. Manter credencial da fábrica separada de credenciais dos providers. Não expor endpoint local ou montar diretórios pessoais nos worktrees.
Sandbox sem privileged, socket Docker, home completo, banco/Redis da fábrica, credenciais de Git amplas ou dados reais. Supervisor confiável prepara checkout e serviços sintéticos. Credenciais de provider inevitavelmente acessíveis ao cliente exigem isolamento de identidade/armazenamento; código executado não deve conseguir lê-las. Validar por teste de acesso negado, não só instrução escrita.
## Worker API
Implementado no FAC-004: `POST /internal/workers/register`, `POST /internal/workers/{id}/heartbeat` e `GET /workers` administrativo. O protocolo interno usa `WORKER_API_TOKEN`, não aceita a credencial administrativa e é bloqueado pelo Nginx público. O worker encerra após três heartbeats consecutivos com falha.

Planejado: claim, eventos, checkpoint e complete. Esses payloads serão versionados; claim será transacional e conclusão exigirá fencing token. Artefatos terão tamanho/hash/paths permitidos, nunca path traversal.
Worker não escolhe arbitrariamente repo, comando ou URL fornecidos em output de IA. Controle só distribui jobs de projetos cadastrados; valida repo/ref e perfis de comando. Eventos/logs são sanitizados e limitados antes de armazenar/exibir.

## Controle administrativo atual

FAC-003 protege `GET /auth/session`, projetos e tickets com `Authorization: Bearer`. O valor de `ADMIN_API_TOKEN` tem no mínimo 32 caracteres, fica somente no ambiente da API e nunca deve entrar no bundle, banco ou logs. O painel conserva a credencial em `sessionStorage`, portanto a implantação exige HTTPS e uma origem web confiável; identidade multiusuário, expiração e revogação granular continuam futuras.

O operador pode criar/listar projetos, criar/listar tickets e promover `DRAFT` para `READY`. A promoção exige `expectedVersion`, incrementa a versão e cria `ticket.ready.v1` na mesma transação. `deduplication_key` único torna retries idempotentes. O dispatcher dessa outbox pertence aos tickets seguintes; estado `READY` ainda não executa trabalho.
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

FAC-000 implementa a fundação local. `compose.dev.yaml` publica PostgreSQL e Redis apenas no loopback para desenvolvimento. A composição completa publica somente o Nginx na porta 8080; API, worker, PostgreSQL e Redis ficam na rede interna. A API aplica migrations com `prisma migrate deploy` e expõe liveness e readiness. FAC-004 registra o worker com UUID/capacidades e mantém heartbeat persistido, com concorrência global igual a 1. O BullMQ ainda processa apenas o probe sintético. Execução de clientes oficiais, leases, fencing e jobs reais continuam pendentes.
