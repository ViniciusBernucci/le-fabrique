# Outbox idempotente e versão otimista

Atualizar um agregado e publicar trabalho são efeitos distintos. No FAC-003, a passagem do ticket para `READY` e a criação de `ticket.ready.v1` ocorrem na mesma transação Prisma. Assim, uma falha não deixa o ticket pronto sem a intenção persistida de despacho.

Retries também precisam de identidade estável. A outbox usa `deduplication_key = ticket:{ticketId}:ready` com índice único. Se o cliente repetir a requisição depois de perder a resposta, a API encontra o ticket já `READY` e o evento existente, retornando o estado atual sem criar outro evento.

O campo `version` protege contra edição baseada em leitura antiga. A atualização exige `id`, estado `DRAFT` e `expectedVersion`; apenas uma transação consegue incrementar para a próxima versão. A chave de outbox evita duplicação da intenção, enquanto a versão evita sobrescrever uma mudança concorrente. O futuro consumidor ainda precisará de sua própria idempotência: outbox única não prova processamento único.
