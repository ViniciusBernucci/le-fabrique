# Heartbeat e parada conservadora

Heartbeat comprova contato recente; não prova sozinho que um processo anterior morreu. No FAC-004, o worker envia heartbeat a cada cinco segundos e zera o contador quando o controle responde. Após três falhas consecutivas, ele fecha o consumidor BullMQ antes de encerrar com erro.

Essa parada limita o período em que o worker pode continuar ativo sem controle e permite que o supervisor reinicie o processo. Quando jobs reais chegarem, lease e fencing ainda serão necessários: o timestamp ajuda a detectar indisponibilidade, mas apenas a confirmação de término da árvore de processos permite liberar outro writer no mesmo workspace.

## Bootstrap nao e heartbeat

OPS-001 separa tres sinais que antes apareciam juntos no terminal:

- registro inicial: a API pode ainda estar subindo; somente rede/5xx recebe retry limitado a 30 tentativas de um segundo;
- heartbeat: ocorre depois do registro e mantem a parada conservadora apos tres falhas consecutivas;
- resultado de job: um job sintetico antigo pode falhar por revisao-base ausente mesmo com o consumidor pronto.

Retry infinito esconderia indisponibilidade, enquanto retry de 401 apenas atrasaria a descoberta de credencial incorreta. Por isso `registerWithRetry` classifica a falha, mantem o ultimo erro e permite testes sem espera real. O exemplo do repositorio comprova sucesso na terceira tentativa, esgotamento na terceira tentativa do teste reduzido e falha imediata para HTTP 401.
