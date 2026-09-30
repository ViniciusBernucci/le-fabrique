# Contratos de runtime no monorepo TypeScript

## Conceito aplicado

Tipos TypeScript desaparecem na execução. Por isso, compartilhar apenas interfaces entre painel, API e worker não valida dados recebidos por HTTP, fila ou variáveis de ambiente. O bootstrap centraliza schemas Zod em `packages/contracts`; os tipos são inferidos desses schemas, mantendo a validação e a tipagem na mesma fonte.

## Exemplo do repositório

O schema de readiness define a resposta esperada da API e é consumido pelo painel. O schema de worker probe valida o payload antes de o processador BullMQ usá-lo. Assim, uma alteração incompatível falha no limite entre processos em vez de circular como um objeto TypeScript presumidamente seguro.

O pacote disponibiliza fonte ESM ao Vite para permitir tree-shaking e compila CommonJS para API e worker. Ele exporta somente contratos neutros: código Prisma, configuração de servidor, segredos e adapters permanecem fora do pacote compartilhado.

## Quando repetir

Todo novo endpoint, evento de outbox, payload de fila ou checkpoint precisa de schema versionado na fronteira. Validação de runtime deve acontecer antes de persistir ou executar o dado. Interfaces internas sem entrada externa podem permanecer apenas em `packages/runtime`.

## Evidência

Os testes de `packages/contracts`, da API e do worker exercitam payloads válidos e rejeitam entradas inválidas. A entrega correspondente está em `documentacoes/infraestrutura/2026-09-30-FAC-000-bootstrap-typescript.md`.
