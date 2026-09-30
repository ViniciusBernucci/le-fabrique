# Heartbeat e parada conservadora

Heartbeat comprova contato recente; não prova sozinho que um processo anterior morreu. No FAC-004, o worker envia heartbeat a cada cinco segundos e zera o contador quando o controle responde. Após três falhas consecutivas, ele fecha o consumidor BullMQ antes de encerrar com erro.

Essa parada limita o período em que o worker pode continuar ativo sem controle e permite que o supervisor reinicie o processo. Quando jobs reais chegarem, lease e fencing ainda serão necessários: o timestamp ajuda a detectar indisponibilidade, mas apenas a confirmação de término da árvore de processos permite liberar outro writer no mesmo workspace.
