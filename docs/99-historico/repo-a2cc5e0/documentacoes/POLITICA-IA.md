# Política comum de engenharia e documentação

## Decisão obrigatória da stack - revisão 2.3
A stack da própria La fabrique está APROVADA: React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL; Redis + BullMQ; Docker Compose na mesma VPS. Não solicitar nova escolha ou confirmação da stack. Não iniciar a fábrica em PHP/Laravel, Angular ou .NET. Esta decisão substitui propostas anteriores.
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`. Contratos compartilhados precisam de validação em runtime. API não executa clientes, builds ou testes; o worker executa esses trabalhos com isolamento, limites e um writer inicial.
Ao trabalhar na própria fábrica, aplicar esta stack. A regra de preservar a stack existente aplica-se somente a projetos EXTERNOS cadastrados para desenvolvimento pela fábrica; ela não altera a stack da La fabrique. Se o repositório da fábrica contiver implementação anterior incompatível, registrar a divergência e planejar a adaptação por etapas; não apagar código existente nem reabrir a escolha tecnológica.
Versões exatas e comandos devem ser fixados conforme compatibilidade no bootstrap; isso não é uma nova decisão de stack. Repositório e funcionalidade do piloto externo permanecem pendentes quando não fornecidos.

## Antes da implementação
Ler README.md, PILOTO.md, PLANO-MVP.md, arquitetura, ADRs e regras locais. Inspecionar o código: documentos não substituem a realidade. Preservar instruções existentes; conflitos relevantes devem ser apresentados ao responsável. Executar apenas um ticket READY com objetivo, escopo, critérios e orçamento definidos.
## Implementação
Na própria fábrica, aplicar a stack aprovada React/NestJS/worker Node em TypeScript. Em projetos externos cadastrados, preservar sua stack e padrões. Não ampliar escopo, migrar linguagem ou adicionar dependência sem necessidade. Planejar curto, trabalhar em branch isolada, limitar ferramentas e nunca acessar produção. Não inserir segredos em prompts, arquivos ou logs. Clientes oficiais autenticados pelo usuário; API e extras desligados no MVP. Escolha somente provider elegível no catálogo validado.
Rodar os checks pertinentes e relatar comandos/resultado real. Distinguir falha de baseline de regressão. Não simular sucesso. Revisão recebe diff, critérios e evidências. Corrigir no máximo duas rodadas antes de pausar com diagnóstico.
## Entrega obrigatória em toda alteração
1. Criar documentacoes/<dominio>/AAAA-MM-DD-TICKET-titulo.md, usando o template.
2. Atualizar documentacoes/<dominio>/README.md para descrever estado atual e funcionamento, contratos e exemplos reais.
3. Atualizar arquitetura e criar ADR se mudou decisão estrutural; revisar API, configuração e operação afetadas.
4. Atualizar documentacoes/INDEX.md, CHANGELOG.md e backlog. Não marcar DONE sem aceite.
5. Criar/atualizar lessons/<conceito>.md apenas quando conceito foi aplicado; atualizar índice, evitando duplicação.
6. Associar evidência à revisão exata. Incluir diff relevante sanitizado ou caminho de patch revisável. Jamais colar segredo, dump ou dados pessoais.
7. Encerrar com o que mudou, como funciona, verificações, limites, rollback e documentação atualizada.
Histórico de entregas é append-only salvo correção identificada; docs atuais são atualizadas em toda mudança pertinente. Comentários de código não substituem relatório.
## Regras de veracidade
Usar IMPLEMENTADO, PLANEJADO ou NÃO VERIFICADO. Não escrever que foi executado algo apenas recomendado. Datas reais no fuso do responsável; IDs reais; hashes reais. Evitar hash circular: usar revisão do código anterior ao commit documental e/ou link do PR final.
## Bloqueios
Ausência de repo/escopo/critério impede somente a execução do piloto externo. Tickets da própria fábrica explicitamente independentes no backlog podem avançar com fixtures sintéticas; nenhum resultado sintético conta como aceite do piloto. Budget esgotado impede novas chamadas. Merge/deploy, ações destrutivas e migrações irreversíveis dependem de autorização explícita.

## Execução e handoff
Ler o checkpoint e conferir SHA, diff e arquivos não rastreados antes de retomar. Nunca depender da memória da conversa anterior. Um writer por worktree; não iniciar outro até confirmar término da árvore de processos anterior. Se não houver provider, preservar trabalho e aguardar. Não alterar login, plano, créditos ou política financeira para continuar.
Relatar provider, versão, modelo efetivo quando conhecido, tempo, uso reportado, fonte e dados desconhecidos. Não converter tokens de assinatura automaticamente em cobrança. Não fingir que observação antiga de cota é atual.
Documentar também entregas parciais/interrompidas e próximos passos; checkpoints não substituem relatório final. Descrever PLANEJADO quando ainda não implementado.
## Contexto e verificação
Não carregar todo o kit a cada ticket. Ler política comum e documentos relevantes ao domínio; Context Builder guarda hashes e omissões. Executar checks na revisão final e invalidar evidência após alteração pertinente. Gate de documentação estrutural precisa de revisão semântica.

## Topologia obrigatória v2.3
Controle, worker, clientes oficiais/autenticação e sandbox executam na mesma VPS. Seguir ADR-002 e infraestrutura/DIMENSIONAMENTO-VPS.md (sob documentacoes). Não depender de MacBook. Um executor inicial; impor limites globais e preservar controle/banco/credenciais fora do alcance do código. Não contratar VPS ou habilitar gastos sem autorização aplicável.

## Stack obrigatória da fábrica - revisão 2.3
React + TypeScript + Vite no painel; NestJS + TypeScript na API; worker Node.js + TypeScript em processo separado; PostgreSQL e Redis + BullMQ. Monorepo apps/web, apps/api, apps/worker e packages/contracts. Ler documentacoes/arquitetura/ADR-003-stack-typescript.md.
Compartilhar esquemas/DTOs e validar dados em runtime; impedir import de segredos/código servidor no painel. Outbox, idempotência, leases e fencing seguem obrigatórios: lock BullMQ não substitui exclusão do writer. API não executa builds/clientes. Executar typecheck, lint, builds e testes relevantes. Preservar a stack somente de pilotos externos; a própria fábrica segue a stack aprovada.
