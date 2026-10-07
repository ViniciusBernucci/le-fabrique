# Plano incremental v3 — segurança antes da execução

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.

## Marcos

| Marco | Trabalho | Saída verificável |
|---|---|---|
| P0 | LF-MT-00 + FAC-001; preflight estático FAC-002 | repo/piloto/baseline, seams e lacunas; dispatch off |
| P1 | LF-MT-01/02 + bootstrap FAC-003/004 | autorização/ownership/RLS/filas sem vazamento A/B |
| P2 | LF-MT-03/04 | pacote mínimo e auth segregada, providers off |
| P3 | LF-MT-05/06/07 | sandbox/rede/broker comprovados sem IA real |
| P4 | LF-MT-08 | primeiro provider oficialmente compatível ou bloqueado com diagnóstico |
| P5 | LF-MT-09/10 + FAC-008–011 | workflow/handoff/checkpoint/review/docs por revisão |
| P6 | LF-MT-11 + FAC-012 | operação/restore/recursos e experimento piloto autorizado |
| P7 | FAC-013 e avaliação de tenants hostis | preflight por provider/perfil; admissão separada |

Não assumir calendário/esforço anterior suficiente: compatibilidade de cliente oficial com tools remotas é risco crítico e gate antecipado de investigação. É possível testar contrato com fake antes, mas isso não libera execução real. Modelo indisponível/sem isolamento → manter bloqueado, não trocar para API nem credencial de outro cliente.

## Piloto e experimento

Um projeto próprio, dados sintéticos, módulo pequeno R0/R1, um executor e um writer. Suite usa A/B fictícios para provar segregação mesmo com piloto funcional único. Meta herdada 8/10 aceitos em até duas correções, 100% documentados, zero extra/API não autorizados e zero writers concorrentes continua meta, não resultado. Registrar fracassos, tempo ativo/espera, uso known/unknown, custo atribuído e recursos.

## Definition of Done

Código/config revisáveis; critérios/checks/segurança na revisão exata; provider e perfil comprovados; artefatos recuperáveis; revisão resolvida; docs atuais/relatório/índice/backlog/matriz atualizados; lessons reais quando aplicáveis; limites e rollback; aceite humano. Não basta finalizar onze tickets para prometer impossibilidade de escape ou admitir código hostil. Liberação de produção comercial é decisão própria sobre termos, dados, perfil de isolamento e risco residual.

VPS única e envelopes permanecem propostas de [infraestrutura](documentacoes/infraestrutura/DIMENSIONAMENTO-VPS.md), sem contratação/deploy neste pacote. API/fallback/extra/autorecharge desligados. Merge/deploy não automáticos. Nenhum ticket implementado neste trabalho documental.
