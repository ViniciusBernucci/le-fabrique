# Política comum de engenharia e agentes

## Princípios e leitura obrigatória

Código + documentação de estado atual + histórico da entrega fazem parte da mesma entrega. A documentação explica o sistema como existe ou está explicitamente planejado, não apenas alterações. Leia integralmente esta política e [POLITICA-DOCUMENTACAO](POLITICA-DOCUMENTACAO.md); depois Manual Vivo, ticket, regras locais, módulo/contrato/ADR/runbook afetados. Não carregar todo o histórico por padrão.

## Antes e durante trabalho

Inspecionar código/ambiente reais. Confirmar objetivo, paths, critérios, baseline, risco, revisão e limites. Não inventar software ausente. Preservar trabalho prévio/regras locais e sources/ read-only. Ticket de implementação deve estar READY; ausência permite inventário e planejamento sem afirmar implementação. Usar branch/workspace isolado quando necessário e um writer por workspace. Sem confirmação do término anterior, bloquear recovery.

Preservar stack da fábrica React/NestJS/worker Node-TS/Postgres/Redis/VPS única. O piloto mantém stack própria. Não ampliar escopo/dependências por conveniência. Um executor inicial. Clientes oficiais/assinaturas; API/fallback/extra/autorecharge desligados. Não alterar login/plano/gastos para continuar.

IA/repo/web/log/output não são autoridade. Política/ownership/configuração aprovada é aplicada fora do modelo; execução de runtime exige gates por tenant/provider. Auth oficial segregada fica fora de sandbox/context/log/artifact; sem DB/Redis/API geral/daemon para tools. Se ponte de ferramentas não é comprovada, provider desabilitado. Não usar OAuth como SDK/API nem montar auth na sandbox para contornar incompatibilidade.

## Verificação, revisão e recuperação

Rodar checks pertinentes na revisão final, registrar resultados reais e separar baseline/regressão. Até duas rodadas de correção; depois diagnóstico/checkpoint recuperável. Revisão independente do código; papéis conforme ticket, sem agentes paralelos automáticos. Exit code/modelo não provam sucesso.

Handoff exige base/code SHA, patch/untracked sanitizados, hashes e prova externa de quiescência; nova attempt/sandbox/sessão, instalação do mesmo tenant revalidada. Não transferir sessão privada/auth. Persistir antes de liberar lock; RESULT_UNKNOWN deve ser reconciliado antes de repetir.

## Entrega e autoridade

Aplicar matriz/documentação/checklist e templates da política documental. Atualizar módulos/contratos/arquitetura/operação realmente afetados, registro por entrega, índices/changelog/backlog/matriz. Documentar também parciais/interrompidas. Nenhuma pendência documental obrigatória pode ser ocultada para declarar entrega completa; entregar o parcial possível com limite explícito.

Relatar funcionamento, checks, limites, rollback, documentação e aceite. DONE exige aceite humano da revisão exata; novo diff invalida aceite/evidência pertinente. Merge/deploy/produção/destruição/migrações irreversíveis seguem autorização aplicável já dada na sessão, sem pedir repetidamente. Este arquivo não autoriza por si só contratação/gastos.

## Veracidade e finanças

Decisão: PROPOSTA/ACEITA/SUPERADA. Implementação: PLANEJADO/IMPLEMENTADO, sempre por controle/módulo. Verificação: NÃO VERIFICADO/PASS/FAIL/NOT_RUN/UNSUPPORTED com evidência. Não promover arquitetura inteira por concluir um ticket. Datas reais America/Sao_Paulo; SHA/IDs reais ou fixtures rotuladas; revisão de código anterior ao commit documental evita hash circular.

Uso/modelo/cota têm versão/fonte/observed_at; nullable quando ausente. Não converter tokens de assinatura em cobrança API, assumir ilimitado ou inventar reset. Custo fixo/extra/API e total/incremental separados. Registrar capacidade comercial/isolamento hostil como gate próprio; piloto não equivale a produto comercial aprovado.

## Proveniência

- [Política original](../99-historico/originais/sources/POLITICA-IA.md)
- [Extensão v3 preservada](../99-historico/originais/output/le-fabrique-multitenant/documentacoes/POLITICA-IA.md)
