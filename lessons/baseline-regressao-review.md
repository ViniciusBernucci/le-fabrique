# Baseline, regressao e review sao sinais diferentes

Um check vermelho depois da alteracao nao prova regressao se o mesmo check ja falhava na revisao-base. No FAC-009, cada comando confiavel roda antes do Developer e depois de cada rodada; o resultado posterior recebe `preExisting=true` somente pelo mesmo nome de check. Falha nova bloqueia review, enquanto falha anterior permanece visivel para decisao humana.

Exit code zero do cliente tambem nao prova o ticket. O coordenador exige runtime concluido, ausencia de regressao e veredito JSON valido de uma segunda execucao `READ_ONLY`. Mesmo `APPROVE` produz `AWAITING_HUMAN`, preservando o aceite humano da revisao exata.

Quiescencia precede classificacao. Se o SandboxRunner nao confirma que um baseline ou check posterior terminou, o fluxo retorna `CHECK_UNQUIESCED` antes de abrir Developer, capturar snapshot ou iniciar correcao. Uma falha conhecida nao autoriza dois processos concorrentes.

Comandos de check pertencem ao request confiavel e entram como argv; mensagens do Developer ou Reviewer nunca se tornam shell. Os testes em `apps/worker/src/developer-workflow.spec.ts` usam portas sinteticas e comprovam baseline preexistente, regressao corrigida, review invalido, limite de tentativas e falha repetida.
