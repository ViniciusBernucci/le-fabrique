# Auditoria de referências e divergências

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.

## Escopo inspecionado

Foram lidos todos os 14 Markdown em sources/ (315 linhas no inventário inicial), o AGENTS.md local do espelho e o PDF consolidado de 45 páginas por extração textual. A conversa de referência foi consultada por read_thread; seu texto é contexto de design, não evidência de implementação. Inspeção textual do PDF foi suficiente para recuperar decisões, não avaliou layout nem regenerou o PDF.

| Fonte | Observação |
|---|---|
| README, BACKLOG, PLANO, ESPEC, MATRIZ, INDEX, POLITICA | Planejamento v2/v2.1, nenhum DONE/software implementado declarado |
| AGENTS (project file), CLAUDE, ANTIGRAVITY, PROMPT-INICIAL | Regras de documentação, versão/preflight, assinaturas e VPS |
| PILOTO, FONTES, CHANGELOG | Repo/acesso/piloto/VPS reais pendentes; fontes consultadas em setembro |
| PDF pp.4–10 | Arquitetura; stack antiga Laravel/Angular, escopo pessoal |
| PDF pp.11–13 | Dimensionamento e ADR-002; VPS única, limites propostos |
| PDF pp.21–22 | Runtime: flags ilustrativas, tools autônomas, nenhum adapter testado |
| PDF p.23 | Handoff: lease/fencing/quiescência, patch e untracked |
| PDF pp.24–26 | Operação/worker API/backup/economia |
| PDF pp.37–45 | Templates/índices/regras/config de exemplo, não config nativa |

Documentos arquitetura/runtime/infra/operação/handoff/economia citados nos MDs não existem como arquivos separados neste espelho; conteúdo estava no PDF. Não alegar que arquivos ausentes foram lidos em disco. Referências históricas podem estar quebradas neste espelho; o índice deste pacote aponta arquivos disponíveis. O repo/código/infra real não foi fornecido, logo estado operacional permanece NÃO VERIFICADO.

## Resoluções

1. Usuário atual fixa React/NestJS/worker TS: substituir proposta Laravel/Angular nos docs atuais, preservar origem histórica.
2. Uso pessoal exclusivo e código próprio eram limites v2; multi-tenant é nova direção planejada. Admissão de código hostil requer perfil/revisão adicional.
3. Provider Runtime administrado não torna modelo confiável. Cliente que executa shell com auth local não cumpre requisito; bloqueá-lo até ponte suportada comprovada.
4. A expressão “isolamento absoluto” vira invariante de nenhum acesso não autorizado e testes técnicos, com risco host/kernel explicitado; não é garantia universal.
5. Topologia única, um executor, assinatura-first/sem extras/API, quiescência/checkpoints e docs obrigatórias permanecem.
6. Backlog antigo executava IA assistida antes da plataforma completa; dividir preflight estático de execução para não circularmente depender de IA sem sandbox para construir sandbox.
7. Sources read-only: produzir revisões em output/le-fabrique-multitenant para integração posterior; nenhum arquivo sincronizado alterado.

## Evidência deste trabalho

Somente artefatos Markdown e inspeção de referências. Checagens documentais e preservação de sources registradas em VALIDACAO-DOCUMENTAL.md. Inventário/hash das referências em MANIFESTO-FONTES.json. Nenhuma credencial foi lida, nenhum CLI foi executado, nenhum teste SEC foi executado e nenhum serviço implantado. Exemplos de IDs/config/paths nos docs são ilustrativos, não evidência real.
