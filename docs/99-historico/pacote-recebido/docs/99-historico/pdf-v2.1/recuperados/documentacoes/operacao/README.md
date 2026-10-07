# Recuperado — documentacoes/operacao/README.md

Fonte: PDF v2.1, páginas 24–25. Transcrição textual histórica; quebras de linha e tabelas podem diferir do original. Não usar como instrução atual.

```text
Fábrica de Software | v2.1 | Planejamento
24
documentacoes/operacao/README.md
Operação da fábrica e worker
Inicialização
Confirmar piloto e políticas; instalar clientes de fontes oficiais com versões registradas; login
humano nos clientes; verificar extras desligados nas contas; executar preflight; registrar worker
com credencial própria de escopo mínimo e validade/rotação. Deploy do controle é uma tarefa
futura autorizada separadamente.
VPS roda proxy HTTPS, frontend, API, scheduler, PostgreSQL e Redis privados. Supervisor interno
roda como usuário dedicado e usa protocolo interno autenticado. Manter credencial da fábrica
separada de credenciais dos providers. Não expor endpoint local ou montar diretórios pessoais nos
worktrees.
Sandbox sem privileged, socket Docker, home completo, banco/Redis da fábrica, credenciais de
Git amplas ou dados reais. Supervisor confiável prepara checkout e serviços sintéticos. Credenciais
de provider inevitavelmente acessíveis ao cliente exigem isolamento de
identidade/armazenamento; código executado não deve conseguir lê-las. Validar por teste de
acesso negado, não só instrução escrita.
Worker API
POST /workers/register (onboarding restrito), POST /workers/{id}/heartbeat, POST
/workers/{id}/jobs/claim, POST /attempts/{id}/events, POST /attempts/{id}/checkpoint, POST
/attempts/{id}/complete. Payloads versionados; autenticação por worker; claim transacional;
sequence/event_id únicos; fencing_token obrigatório. Artefatos com tamanho/hash/paths
permitidos, nunca path traversal.
Worker não escolhe arbitrariamente repo, comando ou URL fornecidos em output de IA. Controle
só distribui jobs de projetos cadastrados; valida repo/ref e perfis de comando. Eventos/logs são
sanitizados e limitados antes de armazenar/exibir.
Recuperação
Queda do worker: parar agendamento local, manter painel, esperar heartbeat; preservar
checkpoints. Internet caiu: parar execução antes de lease expirar. Auth expirada:
AUTH_REQUIRED; usuário faz login oficial local. Cota acabou: handoff seguro ou
WAITING_PROVIDER. Disco cheio/OOM: PAUSED_RESOURCE, limpar somente workspaces já
preservados. CLI mudou schema: bloquear adapter, testar fixture e integrar atualização em ticket
próprio.
Kill switch bloqueia claims, solicita cancelamento e monitora fim das árvores de processos; nunca
declarar cancelado sem evidência. Supervisor aplica timeout e limites de logs/disco, além de
CPU/RAM.
Backup e restauração
Restaurar PostgreSQL numa instância de teste; conferir tickets e versões; recuperar artefatos por
hash; buscar Git/revisão; renovar credencial do worker sem restaurar tokens de provider por cópia
informal. Testar cenário com execução interrompida. Registrar tempo real/RPO efetivo e lacunas.
Observabilidade


Fábrica de Software | v2.1 | Planejamento
25
Fila/etapa, last heartbeat, lease, processos, CPU/RAM/disco, OOM, duração,
provider/modelo/versão, uso conhecido/desconhecido, handoffs, retries, checks/docs e revisão
aceita. Evitar prompts completos e segredos nos logs. Browser de QA com perfil efêmero sem
sessão pessoal.
Evolução
Separar execução em outra VPS é alternativa futura, sujeita a métricas e revisão de isolamento.
APIs podem prover capacidade com orçamento; execução na VPS não elimina termos dos
fornecedores. Código de terceiros exige isolamento mais forte que containers compartilhando
host.
Provisionamento da VPS única no MVP
Selecionar perfil em infraestrutura/DIMENSIONAMENTO-VPS.md e registrar especificações reais.
Configurar firewall: HTTPS público; SSH administrativo restrito; Redis/PostgreSQL/worker privados.
Separar volumes persistentes de temporários. Instalar supervisor como serviço com usuário
dedicado e recuperação após reinício.
Fazer login oficial pelo método suportado para servidor sem interface; callback/fluxo remoto
apenas conforme documentação do cliente. Não desabilitar autenticação nem copiar cookies.
Confirmar credenciais acessíveis ao cliente e inacessíveis a código/testes/logs.
Rodar baseline no mesmo ambiente que executará jobs. Medir recursos e painel durante build.
Reiniciar worker, depois VPS em janela de teste; comprovar leases, nenhuma duplicação e
retomada de checkpoint. Validar backup externo e restauração. Não abrir banco/fila para facilitar
diagnóstico.

```
