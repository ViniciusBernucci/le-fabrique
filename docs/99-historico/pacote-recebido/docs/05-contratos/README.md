# Contratos internos da fábrica

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

| Família | Documento canônico | Situação |
|---|---|---|
| API de controle | [API](api/controle.md) | Endpoints planejados, schemas finais pendentes |
| Worker interno | [Protocolo](api/worker.md) | Não é tool da IA |
| Runtime/adapter | [Runtime](api/runtime.md) | Versão e ponte de tools não verificadas |
| Eventos | [Catálogo](eventos/catalogo.md) | Normalização planejada |
| Dispatch | [Filas/outbox](filas/dispatch.md) | Não há nome de fila imposto sem código |
| Entidades | [Entidades](schemas/entidades.md) | Base v2 + tenancy v3 |
| JobPackage | [Pacote](schemas/job-package.md) | Fixtures ilustrativas sem segredos |
| Workflow | [Estados](schemas/workflow.md) | Ticket/run separado de lifecycle sandbox |
| Checkpoint | [Checkpoint](schemas/checkpoint.md) | Recuperabilidade e quiescência |
| Artifact/context | [Artefatos](schemas/artifact-context.md) | Paths/hashes/ownership |

Contratos são da fábrica, não APIs de fornecedores. Quando código existir, OpenAPI/DTO/schema versionados e testes de contrato tornam-se evidência normativa da implementação; o Markdown explica sem repetir payload incompatível. Breaking change exige versionamento, compatibilidade, consumidor afetado, migração e rollback documentados. Nenhum exemplo neste pacote serve como configuração nativa de CLI.
