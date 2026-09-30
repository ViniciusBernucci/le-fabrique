# Guia para Antigravity

## Decisão obrigatória da stack - revisão 2.3
A stack da própria Le Fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da Le Fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.


Leia documentacoes/POLITICA-IA.md integralmente, README.md, PILOTO.md, o ticket e os documentos dos domínios afetados. Respeite regras locais mais específicas e preserve arquivos existentes ao integrar este guia.
Trabalhe em um ticket READY e uma branch/worktree isolada. O objetivo da fábrica é VPS única de controle e execução + clientes oficiais com assinaturas. Não reintroduza API como padrão. Não habilite extra usage, créditos, autorecharge ou fallback pago.
Antes de editar: confirme objetivo, caminhos, critérios, baseline, provider elegível e limites. Se houver handoff, confira SHA, patch, untracked e evidências. Não iniciar execução se outro writer não estiver comprovadamente parado.
Implemente incremento pequeno; execute checks adequados; diferencie regressão de falha anterior. Até duas rodadas de correção; depois checkpoint e diagnóstico. Não declarar sucesso só por exit code ou mensagem do modelo.
Toda feature/correção/configuração/refatoração exige documentacoes/<dominio>/AAAA-MM-DD-TICKET-titulo.md, README atual do domínio, índice e changelog/backlog atualizados, diff sanitizado e evidências reais. Atualizar lessons com conceitos realmente aplicados e exemplos do repo, evitando duplicação. Atualizar ADRs/contratos/operação quando afetados. Nunca finalizar com documentação pendente.
Final: o que mudou, funcionamento, checks/resultados, limitações, rollback, docs/lessons e estado do aceite. DONE só após aceite da revisão exata. Não realizar merge/deploy ou ação destrutiva sem autorização aplicável.
## Carregamento e uso
ANTIGRAVITY.md é guia do projeto; não presumir que seja nome reservado. A regra comum em .agents/rules/documentacao.md também precisa de teste de carregamento na versão/superfície instalada. Se ignorada, incluir guia e política explicitamente no prompt do job.
Google documenta agy -p para automação. Confirmar versão, modelos, autenticação, saída, permissões e créditos no preflight; browser/E2E só quando capacidade comprovada. Não assumir que todo modelo listado é coberto pelo plano.
UI/QA deve testar critérios com dados sintéticos e anexar evidências da revisão exata. Capturas não provam todas as regras de negócio; checks determinísticos continuam necessários. Navegador sem sessões pessoais, contas de produção ou credenciais reais. Modo always-proceed não substitui isolamento nem é padrão do MVP.

## Topologia obrigatória v2.3
Controle, worker, clientes oficiais/autenticação e sandbox executam na mesma VPS. Seguir ADR-002 e infraestrutura/DIMENSIONAMENTO-VPS.md (sob documentacoes). Não depender de MacBook. Um executor inicial; impor limites globais e preservar controle/banco/credenciais fora do alcance do código. Não contratar VPS ou habilitar gastos sem autorização aplicável.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
