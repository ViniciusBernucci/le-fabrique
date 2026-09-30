# Lifecycle seguro de um cliente CLI

## Conceito aplicado

Executar um cliente oficial exige controlar o processo, nao apenas interpretar sua resposta. O gateway precisa distinguir pedido de cancelamento, timeout, excesso de logs, falha do provider e resultado incompleto, encerrando a arvore antes de liberar outro writer.

No FAC-005, cada `executionId` aponta para um unico grupo de processos ativo. Cancelamento e timeout enviam `SIGTERM`, aguardam o fechamento e possuem fallback `SIGKILL`. O resultado final deriva do motivo registrado pelo supervisor e do evento `turn.completed`, em vez de confiar somente no exit code.

## Eventos como entrada nao confiavel

O JSONL do cliente e validado e reduzido a eventos internos. Mensagens de raciocinio sao ignoradas; output bruto de comandos e stderr servem apenas para classificacao limitada e nao sao devolvidos. Uso e modelo so aparecem quando o evento realmente os informa.

## Exemplo do repositorio

`packages/runtime/src/codex-adapter.ts` mantem o mapa de processos ativos, limita bytes e produz contratos de `packages/contracts`. `fake-codex.cjs` simula sucesso, auth, cota, contexto, permissao, timeout, cancelamento, JSON invalido e excesso de output sem consumir assinatura.

Esse lifecycle ainda precisa de lease/fencing e persistencia antes de executar tickets controlados pelo worker.
