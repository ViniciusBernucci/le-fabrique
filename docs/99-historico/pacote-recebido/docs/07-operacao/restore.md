# Runbook de restauração

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

1. Bloquear claims e execução, registrar incidente/revisão e selecionar backup verificável.
2. Restaurar PostgreSQL em instância privada de teste; confirmar esquema, tickets, versões e ownership tenant/projeto.
3. Recuperar artifacts/checkpoints por hashes e código pela revisão Git; validar paths e autoria antes de usar.
4. Reconciliar attempts/leases/processos órfãos. Falta de prova de término mantém BLOCKED_RECOVERY.
5. Rotacionar credencial interna do worker por mecanismo administrativo; renovar login oficial de provider quando necessário, sem copiar home/sessões.
6. Testar autorização A/B e A1/A2, checks e cenário de execução interrompida. Medir duração real e perda efetiva para comparar RPO/RTO.
7. Registrar responsável, horários, evidências sanitizadas, limitações e decisão de reativação. Restore não recupera automaticamente confiança após comprometimento.

Não executado. Falta acesso ao ambiente, backup real e esquema físico; comandos devem ser derivados da versão efetiva, não de suposição.
