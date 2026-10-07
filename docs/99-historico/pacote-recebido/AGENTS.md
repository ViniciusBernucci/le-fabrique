# Instruções de projeto — Codex

## Leitura obrigatória

Antes de editar, leia [política comum](docs/00-governanca/POLITICA-IA.md), [política documental](docs/00-governanca/POLITICA-DOCUMENTACAO.md), [Manual Vivo](docs/README.md), ticket e capítulos afetados. Não basta ver esses paths: abra os arquivos. Preserve instruções locais e trabalho existente; sources/ é read-only quando presente.

## Regra de entrega

Código + documentação de estado atual + registro de entrega fazem parte da mesma entrega. Use docs/03-modulos e contratos/arquitetura/operação afetados; crie docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md; lessons somente com aplicação real. Atualize índices/changelog/backlog/matriz afetados. Não criar novos relatos em documentacoes/ nem duplicar política nos guias.

## Estado e limites

Inspecione código real; diferencie PLANEJADO/IMPLEMENTADO/NÃO VERIFICADO. React + NestJS + worker Node/TypeScript/Postgres/Redis/VPS única são a direção da fábrica; piloto mantém stack própria. Um executor inicial e um writer por workspace. Assinaturas/clientes oficiais; API/extras/fallback/autorecharge desligados. Auth fora da sandbox e tools exclusivamente mediadas precisam ser comprovadas; sem isso provider fica bloqueado. Não presumir que regra no prompt cria isolamento.

Checks/revisão na revisão exata, duas correções antes de diagnóstico/checkpoint. Sem quiescência não iniciar writer sucessor. DONE só após aceite humano da revisão exata. Autorizações já fornecidas seguem válidas; merge/deploy/produção seguem autorização aplicável.

## Carregamento e papel

Este arquivo deve ficar na raiz do repo real; mesclar em vez de substituir regras existentes. Codex descobre AGENTS.md e overrides hierárquicos; confirmar root/cwd, arquivos override e truncamento na versão instalada. Referência à política não implica carregar seu conteúdo automaticamente: a instrução acima manda abri-la. Papel (implementador/revisor) vem do ticket.

O adapter de runtime é trabalho futuro: registrar versão/binário, autenticação oficial e capabilities com evidência; JSONL/sandbox flag não comprova ponte remota de tools. Não exportar auth.json nem usar API key herdada. Não habilitar agentes paralelos automaticamente.

Para reorganização inicial leia [prompt mestre](prompts/PROMPT-MESTRE-MIGRACAO.md).
