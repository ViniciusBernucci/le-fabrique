# Artifact e ContextManifest

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

Artifact: ownership tenant/project/run/attempt, caminho validado, hash/tamanho/tipo/retention e associação à revisão. Artefatos imutáveis; coleta limitada e sanitizada. Não aceitar traversal/symlink/ZIP slip/bomba; não coletar secrets/dependências/dumps.

ContextManifest: revisão, lista de fontes/hashes, estimated size, omissões/truncamentos e instruction hashes. Seleção determinística não envia todo repo. Resumo aponta à fonte; cache depende de tenant/projeto/revisão/política, sem reutilizar aprovação antiga.

Algoritmos, encoding, formatos físicos e TTLs precisam de schema versionado no repo real. SHA-256 neste pacote verifica documentos de origem, não prova execução de job ou assinatura de capability.

## Proveniência

- [Definições base](../../99-historico/originais/sources/ESPEC-MVP.md)
- [Contexto](../../03-modulos/context-builder/README.md)
