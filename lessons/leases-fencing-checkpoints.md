# Lease, fencing e checkpoint cobrem falhas diferentes

Lease limita por quanto tempo o controle considera um writer vigente. Fencing token identifica a tentativa atual e faz a API recusar escrita atrasada. Nenhum dos dois prova que um processo local morreu: no FAC-008, lease vencido sem `stoppedConfirmed` leva run e ticket a `BLOCKED_RECOVERY`, sem entregar o workspace a outro writer.

Idempotencia precisa cobrir o ciclo inteiro. O dispatcher usa o ID da outbox como `jobId`; run e attempt possuem restricoes unicas; claim, checkpoint e complete devolvem o estado existente quando o mesmo request reaparece. O ensaio HTTP repetiu cada etapa e terminou com uma unica linha em cada tabela.

Checkpoint liga recuperacao logica ao artefato do FAC-007. Ele registra base/code SHA, snapshot ou hash do patch e confirmacao de parada. A conclusao so avanca depois desse registro, evitando que uma mensagem de sucesso sem artefato recuperavel libere a etapa seguinte.
