# Agent Runtime Gateway e Provider Manager

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

Status: preflight do Codex aceito no FAC-002 e primeiro adapter do FAC-005 aceito na revisao `9102fcc614739fd7bd7ca4992b16617db92ca66f`. Integracao ao worker/orquestrador continua planejada.
## Adapters
Codex implementado em `packages/runtime`: `codex exec --json` com perfil nomeado que nega o host, libera somente runtime minimo/workspace necessario e desliga rede de comandos; prompt via stdin, execucao efemera e configuracao do usuario ignorada. Claude: `claude -p --output-format json`, permissões mínimas ainda nao validadas. Antigravity: `agy -p`; validar flags de saída/permissões pela versão instalada antes de assumir JSON.
Exemplos acima descrevem invocação, não autorizam executar código com privilégios. Usar spawn/execFile com array de argumentos e stdin, jamais interpolar prompt em shell. Fixar versão/binário; validar origem oficial e registrar checksums quando disponíveis.
Clientes CLI executam ferramentas autonomamente. Adaptador coleta eventos e controla processo; o host impõe recursos, mounts, rede e identidade. Não fingir que tool_requests da API continua idêntico ao loop interno do CLI.
## Preflight por instalação
Registrar OS/CPU, versão, binário, método oficial de login e plano declarado, modelos realmente acessíveis, modo não interativo, leitura das regras, sandbox, permissão de ferramentas, formato de eventos, cancelamento e comportamento de limite. Desabilitar API keys herdadas e verificar extras desligados. Rodar um ticket sintético de leitura e depois alteração pequena com checks.
Testar credenciais no serviço real: login num terminal não prova acesso pelo usuário systemd/container. Usar armazenamento oficial suportado; não copiar sessões entre máquinas como atalho. Se containerização não suporta login seguro, manter adapter bloqueado até ADR de isolamento compatível.

O FAC-002 validou `codex-cli 0.159.2` no usuario atual da VPS com autenticacao ChatGPT, JSONL e execucao efemera. O perfil aplicado nega leitura do host por padrao, libera somente runtime minimo e a raiz ativa, desliga rede de comandos e bloqueia `~/.codex/auth.json`. O script `scripts/fac-002-codex-preflight.sh` tambem recusa `OPENAI_API_KEY` e `CODEX_API_KEY`. O FAC-005 deve executar novamente o preflight sob a identidade real do servico; a prova no usuario atual nao substitui essa verificacao.
Cada capability carrega verified_at, cli_version e evidence_id. Recursos desconhecidos são unsupported; getUsage pode retornar UNKNOWN. Um provider não passa a AVAILABLE apenas porque existe no catálogo.
## Interface atual
`execute(request, eventSink)` produz eventos sanitizados e resultado validado; `getStatus()` verifica versao/auth; `getCapabilities()` retorna capacidades comprovadas; `getUsage()` retorna observacao `UNKNOWN`; `cancel(execution_id)` confirma processo encerrado. Resume permanece planejado e deve retornar unsupported ate implementacao explicita.

## Contrato ampliado planejado
Request inclui run_id, attempt_id, fencing_token, provider_installation_id, model_requested nullable, workspace_id, base_sha/code_sha, context_manifest, instruction_hashes, command_profile, limites e policy_version.
Resultado inclui schema_version, status, exit_code, model_effective nullable, provider_session_id nullable, revisão, patch/artifact hashes, checks, summary, usage nullable, billing_mode, timestamps e erro normalizado. Não capturar raciocínio interno privado.
Eventos: started, progress, checkpoint, usage_observed, limit_observed, artifact_ready, process_exited e finished. A fábrica valida sequência/schema; output do agente é dado não confiável e não pode alterar orçamento/política.
## Erros normalizados
AUTH_REQUIRED: usuário autentica no fluxo oficial. RATE_LIMITED: cooldown/fallback elegível. TRANSIENT: backoff com limite. CONTEXT_TOO_LARGE: reduzir contexto e registrar mudança. TOOL_DENIED: corrigir perfil/escopo, não ampliar automaticamente. TIMEOUT: cancelar árvore, checkpoint e revisão de estado. RESULT_UNKNOWN: reconciliar antes de repetir. UNSUPPORTED: manter adapter desativado para a capacidade.
Uso e cotas têm unidade/fonte/observed_at/reset_at/confiança. Estado de quota, crédito de assinatura e tarifa API são dados distintos. Não usar endpoints privados ou scraping do site para medir cota.
## Roteamento
Filtrar por política/capacidade e disponibilidade; ordenar por preferência do papel e desempenho recente; adquirir lock do writer; executar. Preferências iniciais configuráveis: implementação Codex; revisão/arquitetura Claude; UI/QA Antigravity. Não usar percentuais fictícios de sucesso; aprender com ensaio registrado.
Cache de roteamento não deve ignorar observações novas de limite. Provider indisponível não implica mudar modelo/conta silenciosamente. API só entra no catálogo quando habilitada explicitamente em política futura.
