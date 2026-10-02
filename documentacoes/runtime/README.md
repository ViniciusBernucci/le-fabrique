# Agent Runtime Gateway e Provider Manager

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

Status: componentes ate FAC-011 e FAC-010A/B/C aceitos. FAC-012A/B adicionam snapshot imutavel e compilador validado de pedido, ambos aguardando aceite. Claude real permanece deslogado e o preflight operacional segue `WAITING_PROVIDER`; o consumer autonomo ainda nao esta ligado.
## Adapters
Codex implementado em `packages/runtime`: `codex exec --json` com perfil nomeado que nega o host, libera somente runtime minimo/workspace necessario e desliga rede de comandos; prompt via stdin, execucao efemera e configuracao do usuario ignorada. Claude implementado por `claude -p --output-format stream-json`, `safe-mode`, `restricted`, allowlist de ferramentas, prompts negados e sessao nao persistida; autenticacao precisa ser assinatura explicita first-party. Antigravity permanece planejado; validar flags de saída/permissões pela versão instalada antes de assumir JSON.
Exemplos acima descrevem invocação, não autorizam executar código com privilégios. Usar spawn/execFile com array de argumentos e stdin, jamais interpolar prompt em shell. Fixar versão/binário; validar origem oficial e registrar checksums quando disponíveis.
Clientes CLI executam ferramentas autonomamente. Adaptador coleta eventos e controla processo; o host impõe recursos, mounts, rede e identidade. Não fingir que tool_requests da API continua idêntico ao loop interno do CLI.
## Preflight por instalação
Registrar OS/CPU, versão, binário, método oficial de login e plano declarado, modelos realmente acessíveis, modo não interativo, leitura das regras, sandbox, permissão de ferramentas, formato de eventos, cancelamento e comportamento de limite. Desabilitar API keys herdadas e verificar extras desligados. Rodar um ticket sintético de leitura e depois alteração pequena com checks.
Testar credenciais no serviço real: login num terminal não prova acesso pelo usuário systemd/container. Usar armazenamento oficial suportado; não copiar sessões entre máquinas como atalho. Se containerização não suporta login seguro, manter adapter bloqueado até ADR de isolamento compatível.

O FAC-002 validou `codex-cli 0.159.2` no usuario atual da VPS com autenticacao ChatGPT, JSONL e execucao efemera. O perfil aplicado nega leitura do host por padrao, libera somente runtime minimo e a raiz ativa, desliga rede de comandos e bloqueia `~/.codex/auth.json`. O script `scripts/fac-002-codex-preflight.sh` tambem recusa `OPENAI_API_KEY` e `CODEX_API_KEY`. O FAC-005 deve executar novamente o preflight sob a identidade real do servico; a prova no usuario atual nao substitui essa verificacao.
Cada capability carrega verified_at, cli_version e evidence_id. Recursos desconhecidos são unsupported; getUsage pode retornar UNKNOWN. Um provider não passa a AVAILABLE apenas porque existe no catálogo.
## Interface atual
`execute(request, eventSink)` produz eventos sanitizados e resultado validado; `getStatus()` verifica versao/auth; `getCapabilities()` retorna capacidades comprovadas; `getUsage()` retorna observacao `UNKNOWN`; `cancel(execution_id)` confirma processo encerrado. Resume permanece planejado e deve retornar unsupported ate implementacao explicita.

`ContextBuilder.build(request)` produz conteudo e manifesto deterministico com hashes e omissoes explicitas. `RuntimeGuard` aplica tentativas, tempo, trocas de provider e repeticao de falha; `sanitizeSubscriptionEnvironment` remove chaves de API herdadas antes de iniciar o cliente.

`WorkspaceManager.create` prepara worktree detached; `SandboxRunner.execute` controla unidade/namespaces/limites; `SnapshotManager.capture/restore` preserva patch binario e untracked com verificacao de integridade. O `DeveloperWorkflow` do FAC-009 coordena essas portas com o adapter: baseline, Developer, checks, snapshot e Reviewer separado. O loop BullMQ do FAC-008 ainda chama apenas a fixture de protocolo porque repositorio e comandos precisam vir de perfil operacional confiavel, nao do output de IA nem de caminho arbitrario do ticket.

FAC-012A faz o job carregar `executionSpecification`, copia estrita e autocontida do projeto, definicao e ticket no instante de READY. Envelope e snapshot precisam concordar em IDs, SHA e versoes. Isso preserva a intencao, mas nao torna URL/comando automaticamente confiavel: o worker ainda deve reconciliar checkout e allowlist antes de substituir a fixture pelo `DeveloperWorkflow`.

FAC-012B adiciona `compileWorkflowRequest`: perfil validado e injetado pelo worker precisa casar projeto/URL/SHA; comandos são comparados por nome, executável e argv exatos; fontes de contexto respeitam caminhos permitidos/proibidos. Limites e modelo nullable também vêm do perfil, sem hardcode. Esta biblioteca pura não está conectada à fila. Caminhos de escrita ainda não são impostos pelo sandbox, então execução real permanece bloqueada.

O preflight FAC-010 observou Claude Code deslogado e Antigravity incapaz de listar modelos sem login. Claude e candidato preferencial somente depois de login Claude App por assinatura e confirmacao de extras desligados; Console/API nao e elegivel. Ate la, roteamento e handoff permanecem planejados.

FAC-010C implementa `ClaudeAdapter`, rota por funcionario e `ProviderHandoff` como bibliotecas testadas. O handoff recebe apenas evidencia terminal minima, objetivo/aceite e snapshot; exige parada confirmada, snapshot posterior ao processo e mesma base, autoriza a troca no RuntimeGuard e restaura em nova worktree. O consumidor real permanece no probe ate existir perfil allowlisted de repositorio/comandos e provider autenticado.

FAC-010B conecta somente Codex por fluxo oficial de device code. O worker mantem o processo em memoria por ate dez minutos, limita output e publica apenas URL/codigo validados no canal efemero. Saida bem-sucedida nao basta: `codex login status` precisa confirmar autenticacao antes de `AVAILABLE`. Encerramento do worker mata o grupo de login ativo; nenhum desafio ou output bruto vira evento persistente.

O FAC-011 introduz `ProviderInstallation` e atribuicoes administrativas por funcao. Essa configuracao expressa intencao, nao evidencia: habilitar uma linha ou digitar um modelo nao muda o estado real do cliente. O worker futuro precisa detectar binario, autenticar pelo fluxo oficial, observar modelos e gravar evidencia antes de o router considerar a instalacao elegivel. Segredos nao pertencem ao contrato nem ao PostgreSQL de controle.

O Reviewer deve devolver JSON validado com `APPROVE` ou `REQUEST_CHANGES`; texto livre, falha do runtime ou schema invalido falha fechado. `APPROVE` produz somente `AWAITING_HUMAN`, nunca `DONE`.

## Contrato ampliado planejado
Request inclui run_id, attempt_id, fencing_token, provider_installation_id, model_requested nullable, workspace_id, base_sha/code_sha, context_manifest, instruction_hashes, command_profile, limites e policy_version.
Resultado inclui schema_version, status, exit_code, model_effective nullable, provider_session_id nullable, revisão, patch/artifact hashes, checks, summary, usage nullable, billing_mode, timestamps e erro normalizado. Não capturar raciocínio interno privado.
Eventos: started, progress, checkpoint, usage_observed, limit_observed, artifact_ready, process_exited e finished. A fábrica valida sequência/schema; output do agente é dado não confiável e não pode alterar orçamento/política.
## Erros normalizados
AUTH_REQUIRED: usuário autentica no fluxo oficial. RATE_LIMITED: cooldown/fallback elegível. TRANSIENT: backoff com limite. CONTEXT_TOO_LARGE: reduzir contexto e registrar mudança. TOOL_DENIED: corrigir perfil/escopo, não ampliar automaticamente. TIMEOUT: cancelar árvore, checkpoint e revisão de estado. RESULT_UNKNOWN: reconciliar antes de repetir. UNSUPPORTED: manter adapter desativado para a capacidade.
Uso e cotas têm unidade/fonte/observed_at/reset_at/confiança. Estado de quota, crédito de assinatura e tarifa API são dados distintos. Não usar endpoints privados ou scraping do site para medir cota.
## Roteamento
Filtrar por política/capacidade e disponibilidade; ordenar pela atribuicao configurada no FAC-011 e desempenho recente; adquirir lock do writer; executar. Cada funcao pode selecionar instalacao e modelo permitido, mas o router ainda deve exigir estado/evidencia elegivel. Não usar percentuais fictícios de sucesso; aprender com ensaio registrado.
Cache de roteamento não deve ignorar observações novas de limite. Provider indisponível não implica mudar modelo/conta silenciosamente. API só entra no catálogo quando habilitada explicitamente em política futura.
