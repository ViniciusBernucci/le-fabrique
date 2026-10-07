# Recuperado — documentacoes/handoff/README.md

Fonte: PDF v2.1, páginas 23–23. Transcrição textual histórica; quebras de linha e tabelas podem diferir do original. Não usar como instrução atual.

```text
Fábrica de Software | v2.1 | Planejamento
23
documentacoes/handoff/README.md
Checkpoint e troca de provider
Regra central
Um writer ativo por workspace. Estado externo é a memória compartilhada: PostgreSQL para
workflow, Git para código/docs, armazenamento de artefatos para patch/untracked/checks e
checkpoint para próximos passos. Não transferir sessão privada de um fornecedor a outro.
Procedimento
1. Solicitar pausa e bloquear novas ferramentas/etapas. Se cliente não pode pausar, cancelar
árvore e aguardar término comprovado.
2. Supervisor coleta status Git, base/code SHA, diff binário quando aplicável e lista de untracked;
exclui segredos e dependências. Fazer snapshot verificável mesmo que o agente não consiga
gerar resumo após esgotar cota.
3. Persistir artefatos com hashes e checkpoint. Commit WIP só se permitido no repo e conteúdo
revisado; alternativamente guardar patch + untracked. Commit sozinho não cobre arquivos não
rastreados.
4. Confirmar envio/recuperabilidade, liberar lock anterior e emitir novo fencing_token. Novo job
rejeita eventos do token antigo.
5. Novo provider lê checkpoint, confere revisão e patch, reexecuta checks pertinentes e continua
somente próximos passos. Não reaplicar patch já presente.
6. Registrar handoff, motivo, origem/destino, duração e resultado. Limite proposto de dois
handoffs; depois pausa com diagnóstico.
Corrida de recuperação
Lease expirado na VPS não prova que processo local morreu. Durante partição de rede, o worker
deve se auto-interromper antes de vencer sua janela de lease. Controle não envia outro writer ao
mesmo workspace até confirmação de quiescência; sem confirmação, manter
BLOCKED_RECOVERY. Não considerar fencing_token suficiente para impedir dois processos
editando arquivos locais.
Heartbeat proposto 15s, lease 90s; worker precisa parar antes de expirar, incluindo margem de
encerramento. Valores devem ser ensaiados. Supervisor sem lease não inicia comandos.
Cancelamento registra resultado desconhecido caso não possa confirmar término.
Conteúdo mínimo
Ticket/run/attempt, objetivo/aceite, escopo, base SHA/code SHA, branch/workspace,
provider/versão/modelo conhecido, arquivos modificados/untracked, patch hash, decisões e
evidências, testes reais e revisão, falhas/limitações, próximos passos, docs pendentes, motivo da
pausa e autenticação/cota observada sem segredos.
Checkpoint não afirma aceite nem transforma checks antigos em atuais. Cancelamento pode ter
consumido cota; guardar uso desconhecido como desconhecido.

```
