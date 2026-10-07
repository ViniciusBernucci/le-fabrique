# Instruções de projeto — Claude Code

## Leitura obrigatória

Antes de editar, leia [política comum](docs/00-governanca/POLITICA-IA.md), [política documental](docs/00-governanca/POLITICA-DOCUMENTACAO.md), [Manual Vivo](docs/README.md), ticket e capítulos afetados. Não basta ver esses paths: abra os arquivos. Preserve instruções locais e trabalho existente; sources/ é read-only quando presente.

## Regra de entrega

Código + documentação de estado atual + registro de entrega fazem parte da mesma entrega. Use docs/03-modulos e contratos/arquitetura/operação afetados; crie docs/09-entregas/<ano>/AAAA-MM-DD-TICKET-titulo.md; lessons somente com aplicação real. Atualize índices/changelog/backlog/matriz afetados. Não criar novos relatos em documentacoes/ nem duplicar política nos guias.

## Estado e limites

Inspecione código real; diferencie PLANEJADO/IMPLEMENTADO/NÃO VERIFICADO. React + NestJS + worker Node/TypeScript/Postgres/Redis/VPS única são a direção da fábrica; piloto mantém stack própria. Um executor inicial e um writer por workspace. Assinaturas/clientes oficiais; API/extras/fallback/autorecharge desligados. Auth fora da sandbox e tools exclusivamente mediadas precisam ser comprovadas; sem isso provider fica bloqueado. Não presumir que regra no prompt cria isolamento.

Checks/revisão na revisão exata, duas correções antes de diagnóstico/checkpoint. Sem quiescência não iniciar writer sucessor. DONE só após aceite humano da revisão exata. Autorizações já fornecidas seguem válidas; merge/deploy/produção seguem autorização aplicável.

## Carregamento e revisão

Mesclar este arquivo na raiz e verificar leitura na versão/mode instalado. Não presumir que modo bare/headless injeta regras: validar com fonte oficial/preflight; se ignoradas, incluir explicitamente guia/políticas no contexto e registrar hashes. Use cliente oficial, sem converter OAuth para SDK/API. Review usa sessão independente e código sem edição na revisão analisada. Não adicionar agentes paralelos automaticamente.

Autenticação/cobrança/tools/eventos/cancelamento devem ser verificados por instalação. Comandos históricos são referência, não capacidade atual garantida. Para migração leia [prompt mestre](prompts/PROMPT-MESTRE-MIGRACAO.md).
