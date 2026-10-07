# Context Builder

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## O que é e por que existe

Construir pacote mínimo do projeto/revisão com proveniência e limites. Essa responsabilidade evita espalhar decisões em vários serviços e permite rastrear comportamento.

## Responsabilidades e limites

Construir pacote mínimo do projeto/revisão com proveniência e limites. Não aceita instrução de repo como política do job; não envia todo o kit em cada ticket.

## Como funciona

Inspecionar paths/imports/checks → excluir secrets/binários/vendor/node_modules/dumps → selecionar fontes → registrar hashes/omissões → emitir pacote autorizado.

## Entidades, estados e integrações

Entidades: ContextManifest, JobPackage, Project policies. Integrações: Projects; Orchestrator; Runtime. Estados de workflow são definidos no contrato compartilhado, evitando máquina de estados divergente por módulo.

## Regras, falhas e recuperação

Contexto grande é reduzido com omissões explícitas; política/hash alterado invalida cache afetado. Segurança: autorização tenant/projeto e revisão são revalidadas; dados/output de modelo não mudam autoridade. Segredos ficam fora de contexto/logs/artefatos.

## Contratos e exemplos

Consulte [fonte canônica relacionada](../../05-contratos/schemas/artifact-context.md). Exemplo didático: um ticket sintético do projeto A1 só pode operar A1; IDs de A2/B1 são negados, mesmo se sugeridos pelo modelo. Este exemplo descreve critério, não teste executado.

## Código, decisões e features

Caminho/versão/classes do código: **ausentes neste espelho**; preencher após inspeção do repositório real. Não usar `src/modules/context-builder` como se existisse. Consulte [ADRs](../../06-decisoes/README.md) e [features](../../04-features/README.md) para relações; registrar IDs reais na implementação.

## Verificação e pendências

Nenhum teste de aplicação executado. A implementação deve associar critérios positivos/negativos, revisão, comandos/resultados e limitações. Ownership, schema físico, entrypoints e testes por responsabilidade permanecem pendentes.

## Proveniência

- [Especificação base](../../99-historico/originais/sources/ESPEC-MVP.md)
- [Fronteiras v3](../../02-arquitetura/fronteiras-e-invariantes.md)

## Contexto planejado e eficiência

TicketContext reúne objetivo, critérios, regras aplicáveis, trechos da especificação, ADR pertinente, arquivos selecionados, testes e achados úteis. Registrar base/revisão e hashes; tamanho e truncamento precisam ser explícitos. Teto de 20–40 mil tokens de entrada era proposta v2.1 a adaptar ao modelo/tarefa, não requisito mínimo nem quota garantida.

Começar com seleção por paths/imports/dependências/busca; embeddings só após benefício demonstrado. Resumo conserva referências acessíveis. Prefixos estáveis podem favorecer cache suportado pelo cliente, sem assumir desconto de assinatura ou cache entre providers. Cache de resultados exige mesma revisão/política/escopo; não preservar desconto sacrificando invalidação. Respostas estruturadas/patches limitam ruído; controle de raciocínio só quando suportado e sem retirar capacidade necessária. Batch é extensão futura de API para trabalho não urgente, nunca requisito da etapa interativa.
