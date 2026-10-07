# Backlog v3 proposto — épico Tenant Isolation & Provider Runtime

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.

Todos os novos tickets permanecem **PLANEJADOS**; nenhum DONE. LF-MT são IDs propostos, verificar colisões no repo real. FAC-001–013 continuam histórico e trabalho funcional; as seguintes dependências refinam seu sequenciamento sem depender de execução de IA insegura para implementar os próprios controles.

| Ticket | Trabalho | Dependências | Gate |
|---|---|---|---|
| LF-MT-00 | Inventário/refatoração preparatória | repo e escopo READY | seams/baseline, dispatch off |
| LF-MT-01 | Identidade tenant/projeto e autorização | LF-MT-00 | Prompt 01 + testes SEC associados |
| LF-MT-02 | Persistência RLS, filas e caches | LF-MT-01 | Prompt 02 + testes SEC associados |
| LF-MT-03 | JobPackage e contexto mínimo | LF-MT-02 | Prompt 03 + testes SEC associados |
| LF-MT-04 | Instalações, credenciais e identidades Linux | LF-MT-03 | Prompt 04 + testes SEC associados |
| LF-MT-05 | Executor e sandbox efêmero | LF-MT-04 | Prompt 05 + testes SEC associados |
| LF-MT-06 | Rede e dependências com egress controlado | LF-MT-05 | Prompt 06 + testes SEC associados |
| LF-MT-07 | Broker e capabilities temporárias | LF-MT-06 | Prompt 07 + testes SEC associados |
| LF-MT-08 | Adapters oficiais e preflight do Provider Runtime | LF-MT-07 | Prompt 08 + testes SEC associados |
| LF-MT-09 | Workflow, handoff, fencing e artefatos | LF-MT-08 | Prompt 09 + testes SEC associados |
| LF-MT-10 | Defesa contra injection, auditoria e gate por revisão | LF-MT-09 | Prompt 10 + testes SEC associados |
| LF-MT-11 | Hardening operacional e liberação por gates | LF-MT-10 | Prompt 11 + testes SEC associados |

## Compatibilidade FAC

FAC-001 mantém contrato do piloto e baseline. FAC-002 divide preflight de versão/login/cobrança sem execução de código (pode ocorrer antes) de baseline IA/handoff (somente após LF-MT-08/09 e gates do ambiente). FAC-003/004 podem ser implementados sem IA de runtime, coordenados com LF-MT-00/01/02, preservando authZ e protocolo interno. FAC-005 e FAC-006 são estendidos pelas etapas 03/04/07/08. FAC-007 é estendido por LF-MT-05/06/09 e passa a exigir suite negativa, não apenas montagem sem home. FAC-008/009/010 exigem LF-MT-09/10 e isolamento validado por provider. FAC-011 incorpora gate/auditoria tenant-scoped. FAC-012 só executa experimento após LF-MT-11. FAC-013 exige preflight próprio do terceiro adapter/browser; não ignora gates anteriores.

Não iniciar execução de código cliente por FAC-002 antes dos controles de sandbox/rede/tools estarem comprovados. Construir a plataforma com agente humano-assistido no repo real não significa que a plataforma já pode operar clientes. Estimativa 23–35 dias v2 não inclui este épico; reestimar depois de inventário/compatibilidade, sem prazo contratado.
