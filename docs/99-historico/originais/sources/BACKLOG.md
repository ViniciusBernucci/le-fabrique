# Backlog v2

Nenhum ticket DONE; FAC-001 aguarda definição do repo/piloto. Não preencher prazo contratual sem capacidade definida.

- FAC-001: PLANEJADO — Contratar piloto; dependências: nenhuma.
- FAC-002: PLANEJADO — Validar clientes e baseline assistido; dependências: FAC-001.
- FAC-003: PLANEJADO — Controle web e persistência; dependências: FAC-002.
- FAC-004: PLANEJADO — Worker interno e identidade de serviço; dependências: FAC-003.
- FAC-005: PLANEJADO — Runtime Gateway e primeiro adapter; dependências: FAC-002, FAC-004.
- FAC-006: PLANEJADO — Context Builder e RuntimeGuard; dependências: FAC-001, FAC-003.
- FAC-007: PLANEJADO — Sandbox e snapshots recuperáveis; dependências: FAC-004, FAC-005.
- FAC-008: PLANEJADO — Orquestrador e checkpoints; dependências: FAC-006, FAC-007.
- FAC-009: PLANEJADO — Developer, checks e revisão; dependências: FAC-008.
- FAC-010: PLANEJADO — Segundo provider e handoff automático; dependências: FAC-005, FAC-008, FAC-009.
- FAC-011: PLANEJADO — Gate documental e Provider Manager; dependências: FAC-009, FAC-010.
- FAC-012: PLANEJADO — Dez tickets e operação; dependências: FAC-011.
- FAC-013: PLANEJADO — Terceiro adapter e QA UI; dependências: FAC-012.

Infraestrutura VPS única incluída em FAC-002/003/004/007/012; perfil Bom recomendado.
