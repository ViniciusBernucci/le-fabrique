# API de controle planejada

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

| Método e caminho da base v2 | Objetivo | Regra indispensável |
|---|---|---|
| POST /projects | Cadastrar projeto/repo/ref/políticas | Tenant/membership server-side |
| POST /tickets | Criar pedido de trabalho | ProjectGrant e critérios |
| POST /tickets/{id}/runs | Criar Run | Idempotency-Key por tenant/principal/operação |
| GET /runs/{id}/events | Consultar eventos | Escopo e reconexão autorizados |
| POST /runs/{id}/pause | Pausar com checkpoint | Sem afirmar parada antes de confirmação |
| POST /runs/{id}/cancel | Cancelar | Resultado desconhecido até reconciliar |
| POST /runs/{id}/resume | Nova tentativa | Checkpoint/lease/fencing/ownership |
| POST /runs/{id}/approvals | Aceitar revisão exata | Alteração posterior invalida aceite |
| GET /workers | Saúde/capacidades | Projeção mínima autorizada |
| GET /providers | Instalações elegíveis | Somente tenant autorizado |
| PATCH /providers/{id}/policy | Atualizar política autorizada | Não recebe OAuth/senha nem gasto por evento da IA |

## Divergência de rota e lacunas

A extensão v3 cita `POST /runs` como abreviação, enquanto a base v2 especifica `/tickets/{id}/runs`. Neste pacote a rota aninhada é a referência documental provisória da base; a rota física deve ser confirmada no controller/OpenAPI real. Não criar alias automaticamente. GET de painel, paginação, auth/token, DTOs e códigos de sucesso não foram especificados completamente; estão pendentes, não inventados.

## Autorização, erros e efeitos

Identidade deriva do canal autenticado. 401 sem identidade; 403/404 genérico para recurso não autorizado deve virar uma convenção única no repo; não distinguir tenant alheio de recurso inexistente. 409 para revisão/estado/fencing obsoleto; 422 contrato inválido. Idempotência precisa guardar escopo e associar resposta/efeito; replay não cria segunda Run. Payload diferente com mesma chave requer comportamento definido e teste antes de liberação.

Uma Run cria dispatch via outbox, não tool direta de shell. Respostas, schemas de request, exemplos positivos/negativos e timeout devem ser preenchidos com código verificável. O gate de implementação rejeita contrato promovido a IMPLEMENTADO sem essas definições e testes.

## Proveniência

- [API v2](../../99-historico/originais/sources/ESPEC-MVP.md)
- [Extensão v3](../schemas/job-package.md)
