# Provider Manager e Router

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## O que é e por que existe

Selecionar instalação elegível por capacidade, tenant, preflight, saúde, cota observada e desempenho. Essa responsabilidade evita espalhar decisões em vários serviços e permite rastrear comportamento.

## Responsabilidades e limites

Selecionar instalação elegível por capacidade, tenant, preflight, saúde, cota observada e desempenho. Marca não determina papel obrigatório; AVAILABLE não garante próxima chamada nem unlimited.

## Como funciona

Filtrar elegibilidade/capacidade → observar disponibilidade → selecionar no mesmo tenant → registrar versão/fonte → cooldown/handoff quando aplicável.

## Entidades, estados e integrações

Entidades: ProviderInstallation, UsageObservation, CredentialMetadata. Integrações: Runtime; Orchestrator; RuntimeGuard. Estados de workflow são definidos no contrato compartilhado, evitando máquina de estados divergente por módulo.

## Regras, falhas e recuperação

AUTH_REQUIRED exige login oficial; sem provider aguarda sem habilitar API/extras. Segurança: autorização tenant/projeto e revisão são revalidadas; dados/output de modelo não mudam autoridade. Segredos ficam fora de contexto/logs/artefatos.

## Contratos e exemplos

Consulte [fonte canônica relacionada](../../05-contratos/api/runtime.md). Exemplo didático: um ticket sintético do projeto A1 só pode operar A1; IDs de A2/B1 são negados, mesmo se sugeridos pelo modelo. Este exemplo descreve critério, não teste executado.

## Código, decisões e features

Caminho/versão/classes do código: **ausentes neste espelho**; preencher após inspeção do repositório real. Não usar `src/modules/providers` como se existisse. Consulte [ADRs](../../06-decisoes/README.md) e [features](../../04-features/README.md) para relações; registrar IDs reais na implementação.

## Verificação e pendências

Nenhum teste de aplicação executado. A implementação deve associar critérios positivos/negativos, revisão, comandos/resultados e limitações. Ownership, schema físico, entrypoints e testes por responsabilidade permanecem pendentes.

## Proveniência

- [Especificação base](../../99-historico/originais/sources/ESPEC-MVP.md)
- [Fronteiras v3](../../02-arquitetura/fronteiras-e-invariantes.md)

## Seleção, estados e cotas herdados

Catalogar UNCONFIGURED, AUTH_REQUIRED, AVAILABLE, BUSY, RATE_LIMITED, COOLDOWN, ERROR e DISABLED. A observação de quota guarda value/unidade/fonte/observed_at e reset_at nullable; várias janelas/modelos podem coexistir. AVAILABLE é última elegibilidade comprovada, não garantia de próxima chamada. UNKNOWN não equivale a ilimitado.

Preferências históricas configuráveis: Codex para implementação, Claude para análise/review, Antigravity para UI/QA. São hipóteses de escolha, sem ranking ou percentuais de sucesso comprovados. Ordenar somente providers já elegíveis pela política/capacidade/saúde e desempenho medido.

Cota atingida interrompe writer, checkpoint e handoff seguro; nenhum disponível gera WAITING_PROVIDER. Se reset é conhecido, uma sondagem limitada após o horário; sem reset, backoff limitado. Não criar contas, alternar identidades ou usar endpoints privados para contornar limite. Cache de roteamento não ignora observação mais nova. Falha de auth requer ação no cliente oficial; transitório tem retry limitado, limite de uso não recebe retry imediato.
