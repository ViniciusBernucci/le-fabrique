# Recuperado — ANTIGRAVITY.md

Fonte: PDF v2.1, páginas 31–31. Transcrição textual histórica; quebras de linha e tabelas podem diferir do original. Não usar como instrução atual.

```text
Fábrica de Software | v2.1 | Planejamento
31
ANTIGRAVITY.md
Guia para Antigravity
Leia documentacoes/POLITICA-IA.md integralmente, README.md, PILOTO.md, o ticket e os
documentos dos domínios afetados. Respeite regras locais mais específicas e preserve arquivos
existentes ao integrar este guia.
Trabalhe em um ticket READY e uma branch/worktree isolada. O objetivo da fábrica é VPS única de
controle e execução + clientes oficiais com assinaturas. Não reintroduza API como padrão. Não
habilite extra usage, créditos, autorecharge ou fallback pago.
Antes de editar: confirme objetivo, caminhos, critérios, baseline, provider elegível e limites. Se
houver handoff, confira SHA, patch, untracked e evidências. Não iniciar execução se outro writer
não estiver comprovadamente parado.
Implemente incremento pequeno; execute checks adequados; diferencie regressão de falha
anterior. Até duas rodadas de correção; depois checkpoint e diagnóstico. Não declarar sucesso só
por exit code ou mensagem do modelo.
Toda feature/correção/configuração/refatoração exige
documentacoes/<dominio>/AAAA-MM-DD-TICKET-titulo.md, README atual do domínio, índice e
changelog/backlog atualizados, diff sanitizado e evidências reais. Atualizar lessons com conceitos
realmente aplicados e exemplos do repo, evitando duplicação. Atualizar ADRs/contratos/operação
quando afetados. Nunca finalizar com documentação pendente.
Final: o que mudou, funcionamento, checks/resultados, limitações, rollback, docs/lessons e estado
do aceite. DONE só após aceite da revisão exata. Não realizar merge/deploy ou ação destrutiva
sem autorização aplicável.
Carregamento e uso
ANTIGRAVITY.md é guia do projeto; não presumir que seja nome reservado. A regra comum em
.agents/rules/documentacao.md também precisa de teste de carregamento na versão/superfície
instalada. Se ignorada, incluir guia e política explicitamente no prompt do job.
Google documenta agy -p para automação. Confirmar versão, modelos, autenticação, saída,
permissões e créditos no preflight; browser/E2E só quando capacidade comprovada. Não assumir
que todo modelo listado é coberto pelo plano.
UI/QA deve testar critérios com dados sintéticos e anexar evidências da revisão exata. Capturas
não provam todas as regras de negócio; checks determinísticos continuam necessários. Navegador
sem sessões pessoais, contas de produção ou credenciais reais. Modo always-proceed não
substitui isolamento nem é padrão do MVP.
Topologia obrigatória v2.1
Controle, worker, clientes oficiais/autenticação e sandbox executam na mesma VPS. Seguir
ADR-002 e infraestrutura/DIMENSIONAMENTO-VPS.md (sob documentacoes). Não depender de
MacBook. Um executor inicial; impor limites globais e preservar controle/banco/credenciais fora do
alcance do código. Não contratar VPS ou habilitar gastos sem autorização aplicável.

```
