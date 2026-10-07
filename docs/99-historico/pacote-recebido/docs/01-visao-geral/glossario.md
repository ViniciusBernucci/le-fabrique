# Glossário

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** neste espelho.

## Tenant

Unidade de ownership e isolamento; não é apenas um prefixo de diretório.

## Project

Repositório/ref/políticas/checks cadastrados dentro de um tenant.

## Ticket

Pedido de trabalho com escopo, risco, limites e critérios verificáveis.

## Run

Execução de um ticket; guarda base/revisão, política e estado.

## Step

Etapa de uma execução, por exemplo implementação ou revisão.

## Attempt

Tentativa de uma etapa com instalação, lease, fencing e ambiente específicos.

## Worker

Serviço autenticado que recebe jobs e coordena execução; não é o modelo.

## Executor Manager

Componente confiável de lifecycle, admissão e coleta; não é ferramenta da IA.

## Provider

Fornecedor/cliente de IA (Codex, Claude ou Antigravity); não é um papel obrigatório.

## ProviderInstallation

Instalação validada por tenant/provider/worker com metadados de preflight.

## Provider Runtime

Processo autenticado separado do código do cliente, com ferramentas mediadas.

## Tool Broker

Autoriza operações restritas fora do modelo e as executa na sandbox.

## Capability

Autorização temporária vinculada a canal/attempt/escopo; não é credencial de fornecedor.

## Sandbox

Ambiente descartável restrito por tentativa, separado do runtime autenticado.

## Checkpoint

Estado recuperável com revisão, patch/untracked, hashes e prova de writer parado.

## Artifact

Arquivo/resultado validado e imutável por hash, com ownership e retenção.

## ContextManifest

Proveniência do contexto: fontes/hashes/revisão/omissões/instruções.

## Lease

Prazo de posse de uma execução; expiração não prova término de processo.

## Fencing token

Versão de autoridade que rejeita eventos antigos; não mata writer local.

## Quiescência

Confirmação externa de fim da árvore/processos antes de coleta ou novo writer.

## Outbox

Registro transacional de dispatch no banco, publicado na fila com idempotência.

## Approval

Aceite associado à revisão exata e políticas/configuração relevantes.

## UsageObservation

Uso observado com unidade/fonte/horário; desconhecido é nullable.

## LedgerEntry

Registro financeiro decimal que separa assinatura fixa, extras e API.

## C4

Modelo de arquitetura por contexto, containers e componentes; container não significa Docker.

## ADR

Registro de decisão com contexto, alternativas, consequências e condições de revisão.

## Manual Vivo

Navegação didática do estado documentado, ligada aos capítulos canônicos.

## Delivery Record

Registro histórico de uma entrega; não substitui documentação do módulo.

## R0–R4

Escala de risco: documental/cosmético; lógica local; integração; auth/pagamentos/segredos; produção/infra/migração irreversível.

## Proveniência

- [Entidades v2](../99-historico/originais/sources/ESPEC-MVP.md)
- [Identidade v3](../03-modulos/tenant-isolation/README.md)
