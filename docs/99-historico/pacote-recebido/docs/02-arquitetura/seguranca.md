# Segurança e fronteiras

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

A política é imposta por autorização, RLS, broker, capabilities, filesystem, rede e lifecycle fora do modelo. Prompt é orientação, não barreira. Assumir prompt injection bem-sucedida e código potencialmente hostil.

- [Threat model](seguranca/threat-model.md): ativos, adversários, riscos residuais e incidente.
- [Rede e egress](seguranca/rede-e-egress.md): destinos efetivos, SSRF, dependências e saída de inferência.
- [Tenant isolation](../03-modulos/tenant-isolation/README.md): ownership e dados.
- [Runtime](../03-modulos/runtime/README.md): auth oficial fora da sandbox.
- [Sandbox](../03-modulos/sandbox/README.md): namespaces, mounts, recursos e lifecycle.
- [Tool broker](../03-modulos/tool-broker/README.md): ferramentas e capabilities temporárias.
- [SEC-01–14](../08-desenvolvimento/testes-seguranca.md): testes negativos planejados, não executados.

Piloto próprio/sintético e admissão de código hostil são gates distintos. Falha de política bloqueia execução. Nenhum documento confirma eficácia de barreira sem teste na versão/configuração real.
