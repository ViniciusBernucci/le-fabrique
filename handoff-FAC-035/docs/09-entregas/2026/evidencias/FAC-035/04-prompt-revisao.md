# Sessão 3 — Revisão independente

Sessão nova, sem edição de código. Rodar depois das sessões 1 e 2 commitadas.

```text
Você é revisor independente do FAC-035. Não edite nenhum arquivo de código; só escreva o relatório indicado abaixo.

1. `git branch --show-current` deve ser `feat/fac-035-tarefas-scrum`; `git status --short` limpo. Senão, PARE.
2. Leia integralmente: CLAUDE.md, as duas políticas em docs/00-governanca/, skills/00-perfil-la-fabrique.md, skills/revisor-de-codigo/SKILL.md, skills/security-audit/SKILL.md, docs/08-desenvolvimento/tickets/FAC-035.md, docs/09-entregas/2026/evidencias/FAC-035/00-plano.md e 03-especificacao-visual.md.
3. Rode `git diff developer...HEAD --stat` e revise o diff completo.
4. Para cada um dos 12 critérios do ticket: PASS / FAIL / NÃO VERIFICÁVEL, com arquivo:linha ou teste que comprova.
5. Verifique também: nenhuma tabela/migração existente alterada; nenhum uso de localStorage para dados de tarefas; todas as rotas sob AdminAuthGuard; toda escrita em item numa transação com activity; tratamento de 409 na UI sem reenvio automático; apenas tokens --hud-* no CSS; nenhuma dependência nova.
6. Rode os checks: npm run typecheck, npm test, npm run lint, npm run build, python3 scripts/validar-documentacao.py. Registre resultado.
7. Grave o relatório em docs/09-entregas/2026/evidencias/FAC-035/05-revisao.md com achados ordenados por severidade (bloqueante, importante, sugestão), cada um com path, linha, problema e correção proposta.
Não faça commit. PARE ao final.
```
