# Runbook de backup

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Proposta herdada: backup diário PostgreSQL criptografado fora da VPS; sete diários/quatro semanais. Git remoto e artefatos necessários também precisam estar recuperáveis. Retenção inicial: artifacts 30 dias, auditoria resumida 90 dias. Metas RPO 24h/RTO 4h **NÃO VERIFICADAS**.

Responsável e serviço de storage/chaves/agenda ainda não definidos. Inventariar volumes e ownership antes de configurar. Criptografar e restringir objeto exato; registrar horário, resultado, revisão/esquema, tamanho/hash e localização sem segredo. Monitorar falha/idade e executar restore de teste. Auth de fornecedor não é copiada informalmente; padrão de recuperação é reautenticação oficial.

Não colocar backup apenas no mesmo disco. Limpeza ocorre após evidência de preservação e validação de ownership; não executar prune genérico. Não alterar retenção sem verificar requisitos de dados aplicáveis ao uso real.

## Proveniência

- [Operação original](../99-historico/pdf-v2.1/recuperados/documentacoes/operacao/README.md)
- [Política atual](execucao-e-recuperacao.md)
