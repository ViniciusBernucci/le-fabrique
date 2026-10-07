# Tickets

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## O que é e por que existe

Transformar pedido em trabalho pequeno com objetivo e critérios verificáveis. Essa responsabilidade evita espalhar decisões em vários serviços e permite rastrear comportamento.

## Responsabilidades e limites

Transformar pedido em trabalho pequeno com objetivo e critérios verificáveis. Não afirma sucesso de Run nem aceita diff automaticamente.

## Como funciona

Triar pedido → definir comportamento atual/esperado → escopo/checks/risco/limites → READY somente quando completo.

## Entidades, estados e integrações

Entidades: Ticket, Project, Run. Integrações: Projects; Runs; Approvals. Estados de workflow são definidos no contrato compartilhado, evitando máquina de estados divergente por módulo.

## Regras, falhas e recuperação

Ticket vago retorna à triagem antes de consumo de IA. Segurança: autorização tenant/projeto e revisão são revalidadas; dados/output de modelo não mudam autoridade. Segredos ficam fora de contexto/logs/artefatos.

## Contratos e exemplos

Consulte [fonte canônica relacionada](../../05-contratos/schemas/workflow.md). Exemplo didático: um ticket sintético do projeto A1 só pode operar A1; IDs de A2/B1 são negados, mesmo se sugeridos pelo modelo. Este exemplo descreve critério, não teste executado.

## Código, decisões e features

Caminho/versão/classes do código: **ausentes neste espelho**; preencher após inspeção do repositório real. Não usar `src/modules/tickets` como se existisse. Consulte [ADRs](../../06-decisoes/README.md) e [features](../../04-features/README.md) para relações; registrar IDs reais na implementação.

## Verificação e pendências

Nenhum teste de aplicação executado. A implementação deve associar critérios positivos/negativos, revisão, comandos/resultados e limitações. Ownership, schema físico, entrypoints e testes por responsabilidade permanecem pendentes.

## Proveniência

- [Especificação base](../../99-historico/originais/sources/ESPEC-MVP.md)
- [Fronteiras v3](../../02-arquitetura/fronteiras-e-invariantes.md)
