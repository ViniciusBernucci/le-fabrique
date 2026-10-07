# Recuperado — documentacoes/POLITICA-IA.md

Fonte: PDF v2.1, páginas 27–28. Transcrição textual histórica; quebras de linha e tabelas podem diferir do original. Não usar como instrução atual.

```text
Fábrica de Software | v2.1 | Planejamento
27
documentacoes/POLITICA-IA.md
Política comum de engenharia e
documentação
Antes da implementação
Ler README.md, PILOTO.md, PLANO-MVP.md, arquitetura, ADRs e regras locais. Inspecionar o
código: documentos não substituem a realidade. Preservar instruções existentes; conflitos
relevantes devem ser apresentados ao responsável. Executar apenas um ticket READY com
objetivo, escopo, critérios e orçamento definidos.
Implementação
Preservar stack e padrões do repo alvo. Não ampliar escopo, migrar linguagem ou adicionar
dependência sem necessidade. Planejar curto, trabalhar em branch isolada, limitar ferramentas e
nunca acessar produção. Não inserir segredos em prompts, arquivos ou logs. Clientes oficiais
autenticados pelo usuário; API e extras desligados no MVP. Escolha somente provider elegível no
catálogo validado.
Rodar os checks pertinentes e relatar comandos/resultado real. Distinguir falha de baseline de
regressão. Não simular sucesso. Revisão recebe diff, critérios e evidências. Corrigir no máximo
duas rodadas antes de pausar com diagnóstico.
Entrega obrigatória em toda alteração
1. Criar documentacoes/<dominio>/AAAA-MM-DD-TICKET-titulo.md, usando o template.
2. Atualizar documentacoes/<dominio>/README.md para descrever estado atual e
funcionamento, contratos e exemplos reais.
3. Atualizar arquitetura e criar ADR se mudou decisão estrutural; revisar API, configuração e
operação afetadas.
4. Atualizar documentacoes/INDEX.md, CHANGELOG.md e backlog. Não marcar DONE sem aceite.
5. Criar/atualizar lessons/<conceito>.md apenas quando conceito foi aplicado; atualizar índice,
evitando duplicação.
6. Associar evidência à revisão exata. Incluir diff relevante sanitizado ou caminho de patch
revisável. Jamais colar segredo, dump ou dados pessoais.
7. Encerrar com o que mudou, como funciona, verificações, limites, rollback e documentação
atualizada.
Histórico de entregas é append-only salvo correção identificada; docs atuais são atualizadas em
toda mudança pertinente. Comentários de código não substituem relatório.
Regras de veracidade
Usar IMPLEMENTADO, PLANEJADO ou NÃO VERIFICADO. Não escrever que foi executado algo
apenas recomendado. Datas reais no fuso do responsável; IDs reais; hashes reais. Evitar hash
circular: usar revisão do código anterior ao commit documental e/ou link do PR final.
Bloqueios


Fábrica de Software | v2.1 | Planejamento
28
Ausência de repo/escopo/critério impede a implementação do piloto, mas permite inspeção e
planejamento. Budget esgotado impede novas chamadas. Merge/deploy, ações destrutivas e
migrações irreversíveis dependem de autorização explícita.
Execução e handoff
Ler o checkpoint e conferir SHA, diff e arquivos não rastreados antes de retomar. Nunca depender
da memória da conversa anterior. Um writer por worktree; não iniciar outro até confirmar término
da árvore de processos anterior. Se não houver provider, preservar trabalho e aguardar. Não
alterar login, plano, créditos ou política financeira para continuar.
Relatar provider, versão, modelo efetivo quando conhecido, tempo, uso reportado, fonte e dados
desconhecidos. Não converter tokens de assinatura automaticamente em cobrança. Não fingir que
observação antiga de cota é atual.
Documentar também entregas parciais/interrompidas e próximos passos; checkpoints não
substituem relatório final. Descrever PLANEJADO quando ainda não implementado.
Contexto e verificação
Não carregar todo o kit a cada ticket. Ler política comum e documentos relevantes ao domínio;
Context Builder guarda hashes e omissões. Executar checks na revisão final e invalidar evidência
após alteração pertinente. Gate de documentação estrutural precisa de revisão semântica.
Topologia obrigatória v2.1
Controle, worker, clientes oficiais/autenticação e sandbox executam na mesma VPS. Seguir
ADR-002 e infraestrutura/DIMENSIONAMENTO-VPS.md (sob documentacoes). Não depender de
MacBook. Um executor inicial; impor limites globais e preservar controle/banco/credenciais fora do
alcance do código. Não contratar VPS ou habilitar gastos sem autorização aplicável.

```
