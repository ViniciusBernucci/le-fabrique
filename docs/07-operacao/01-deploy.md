> Leitura: [← Anterior](00-README.md) · [Índice didático](../02-INDEX.md) · [Próximo →](02-execucao-e-recuperacao.md)

> Integração DOC-MV-001: texto de direção/planejamento do pacote. O [AS-IS atual](../02-arquitetura/01-as-is.md) prevalece para implementação. Não confundir proposta com controle instalado.

# Runbook de deploy

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** na origem do pacote.

## Pré-condições e responsável

Responsável administrativo e janela autorizada; VPS/OS/kernel/versões e backup testado; revisão de código/config/imagem/política identificada; gates de segurança e compatibilidade por provider. Sem esses dados este procedimento permanece PLANEJADO.

## Sequência planejada

1. Bloquear novos claims e confirmar fim dos writers; preservar checkpoints/artifacts recuperáveis.
2. Registrar baseline, revisão e config segura anterior; separar volumes temporários/persistentes.
3. Aplicar proxy HTTPS, serviços internos privados, identidades e limites agregados conforme perfil validado.
4. Migrar dados somente com plano/backfill/ownership/restore aprovado; não atribuir órfãos arbitrariamente.
5. Aplicar versão de controle/worker/perfis e executar checks autorizados, incluindo negativos afetados.
6. Validar heartbeat, ownership, auth segregada, admission, observabilidade e backup após reboot de ensaio.
7. Reabrir admission apenas após gate e aceite aplicáveis. Provider incompatível permanece off.

## Rollback e evidência

Suspender jobs, preservar estado e restaurar versão segura de código/config; migração de dados exige estratégia própria testada. Nunca remover RLS/egress/segregação para reverter. Registrar resultado observado e versões/hashes reais. Compose e templates systemd existem no repo: compose.yaml e infrastructure/systemd. Não foram executados/instalados por esta migração; não afirmar estado do serviço a partir do template. Consulte a referência local de infraestrutura e ambiente-local para comandos exatos.

## Base local

[Infraestrutura integral](infraestrutura/01-referencia-v2.3.md), [Compose controle](../../compose.yaml), [setup](../08-desenvolvimento/01-ambiente-local.md).
