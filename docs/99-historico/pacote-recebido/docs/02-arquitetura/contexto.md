# C4 nível 1 — contexto

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

```mermaid
flowchart LR
  U[Usuário com acesso a projeto] -->|tickets e aceite por HTTPS| F[Fábrica de Software]
  ADM[Administrador] -->|políticas e onboarding| F
  F -->|checkout e publicação autorizada| G[Repositório Git externo]
  F -->|contexto autorizado via cliente oficial| AI[Codex / Claude / Antigravity]
  F -->|backup e artefatos autorizados| A[Armazenamento externo]
```

GitHub é um exemplo de hospedagem Git, não integração já implementada. Usuário e administrador são papéis, não serviços. Fornecedores veem o contexto autorizado por design; segredos e dados de outros projetos não integram esse contexto. Integrações externas e elegibilidade permanecem a validar.
