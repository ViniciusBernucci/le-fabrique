# Documentation Gate

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## O que é e por que existe

Exigir documentação atual coerente, registro histórico e evidência da revisão antes do aceite. Essa responsabilidade evita espalhar decisões em vários serviços e permite rastrear comportamento.

## Responsabilidades e limites

Exigir documentação atual coerente, registro histórico e evidência da revisão antes do aceite. Presença de MD ou exit code não prova conteúdo correto; gate não marca DONE.

## Como funciona

Identificar impacto → validar arquivos/links/seções/proveniência → conferir revisão/checks/diff → revisão de veracidade → permitir AWAITING_HUMAN.

## Entidades, estados e integrações

Entidades: Delivery record, code revision, docs paths, checks. Integrações: Módulos; Contracts; Approvals; revisão semântica. Estados de workflow são definidos no contrato compartilhado, evitando máquina de estados divergente por módulo.

## Regras, falhas e recuperação

Registro IMPLEMENTADO com placeholders/sem evidência é rejeitado; teste não executado nunca é PASS. Segurança: autorização tenant/projeto e revisão são revalidadas; dados/output de modelo não mudam autoridade. Segredos ficam fora de contexto/logs/artefatos.

## Contratos e exemplos

Consulte [fonte canônica relacionada](../../00-governanca/POLITICA-DOCUMENTACAO.md). Exemplo didático: um ticket sintético do projeto A1 só pode operar A1; IDs de A2/B1 são negados, mesmo se sugeridos pelo modelo. Este exemplo descreve critério, não teste executado.

## Código, decisões e features

Caminho/versão/classes do código: **ausentes neste espelho**; preencher após inspeção do repositório real. Não usar `src/modules/documentation-gate` como se existisse. Consulte [ADRs](../../06-decisoes/README.md) e [features](../../04-features/README.md) para relações; registrar IDs reais na implementação.

## Verificação e pendências

Nenhum teste de aplicação executado. A implementação deve associar critérios positivos/negativos, revisão, comandos/resultados e limitações. Ownership, schema físico, entrypoints e testes por responsabilidade permanecem pendentes.

## Proveniência

- [Especificação base](../../99-historico/originais/sources/ESPEC-MVP.md)
- [Fronteiras v3](../../02-arquitetura/fronteiras-e-invariantes.md)
