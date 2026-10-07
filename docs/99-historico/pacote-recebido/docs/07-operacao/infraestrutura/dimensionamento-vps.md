# Topologia Linux, recursos e provisionamento

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.

Uma VPS Linux continua alojando React/NestJS, PostgreSQL, Redis, worker TS, Executor, runtimes e sandboxes; inferência externa. SSH restrito/HTTPS público; bancos, worker, broker, helper e runtime sem portas públicas. Não foi informada VPS contratada nem acesso administrativo. Não provisionar com base apenas nesta proposta.

| Perfil herdado | Recursos propostos | Inicial |
|---|---|---|
| Mínimo | 4 vCPU / 8 GB / 120 GB | um job leve, execução agregada até 3 GB |
| Bom | 8 vCPU / 16 GB / 200 GB | um job, até 4 vCPU / 6 GB / 256 PIDs / 30 min |
| Ideal | 8 vCPU / 32 GB / 300 GB | um job inicialmente; ampliar somente após ensaio |

Valores são estimativas, não benchmark de React/NestJS nem dos CLIs. Perfil Bom reserva aproximadamente 6 GB para host/controle/banco/supervisor, até 6 GB para job incluindo runtime/browser/auxiliares e 4 GB de margem. Isolamento mais forte pode aumentar overhead; medir antes de admitir tenants. Um executor global, um writer por workspace; mais contas não justificam mais concorrência.

## Identidades e diretórios planejados

`lf-control` para aplicação; `lf-worker` para coordenação mínima; helper lifecycle com privilégio delimitado; `lf-provider-<tenant>-<provider>` por instalação; sandboxes com identidade não root e namespaces separados. Nomes derivam de IDs opacos internos validados, não input textual do cliente. Sem UID reutilizado antes de cleanup/ownership completo. Runtime não integra grupos do controle/daemon. Arquivos parent com travessia restrita; 0700/0600 nos homes/segredos, ACL mínima e LSM validada. Systemd pode impor filesystem/processos/rede conforme versão; não copiar lista de flags sem comprovar efeito.

Exemplos de áreas físicas, nunca mounts de diretório pai para agentes:

```text
/var/lib/lefabrique/control/                       # serviço de controle apenas
/var/lib/lefabrique/provider-auth/<tenant>/<provider>/
/var/lib/lefabrique/provider-sessions/<tenant>/<project>/<attempt>/
/var/lib/lefabrique/workspaces/<tenant>/<project>/<attempt>/
/var/lib/lefabrique/artifacts/<tenant>/<project>/<run>/<attempt>/
```

Sandbox vê somente /workspace, /context, /instructions, /output e toolchain mínima. Usuários Linux separados reforçam DAC, mas não substituem namespaces/network policy/broker. Directory traversal, parent mounts, proc host e home global são proibidos. Auth por instalação pode ser persistente; sessão/model memory por attempt é efêmera.

## Runbook de provisionamento futuro

Inventariar OS/kernel/runtime e virtualização disponível; registrar specs úteis, patches, digest de imagens e baseline. Provisionar controles de auth/rede/RLS antes de jobs; helper de perfis imutáveis, UID segregados, secret paths, quotas e observabilidade sem segredos. Validar mounts/capabilities/seccomp/LSM e filtros reais em cada criação, depois do reboot e após updates. Se controle obrigatório não existir no host, bloquear perfil.

Admission pausa com disco livre <20%, memória >85% sustentada por 5min, OOM ou heartbeat perdido, valores propostos sujeitos a ensaio. Quotas por tenant, logs, artefatos, caches e runtime; preservar controle/banco sob fork bomb e I/O/disco. Medir RSS/cgroup, CPU, swap, I/O, disco, p95 da API (meta provisória 1s para operações administrativas comuns) e resultado sob build. Não subir limites nem desligar sandbox para fazer benchmark passar.

Backup externo não exige segunda VPS de execução. VPS única não fornece HA; perda do host afeta toda fábrica. Rollback de deploy suspende jobs, preserva checkpoint e restaura versão de configuração segura; não reabre rede ou volta ao compartilhamento de auth.


## Origem desta edição

[Versão original preservada](../../99-historico/originais/output/le-fabrique-multitenant/documentacoes/infraestrutura/DIMENSIONAMENTO-VPS.md). Migração editorial de paths em 2026-10-06; conteúdo de engenharia continua proposto.

## Detalhes herdados úteis para planejamento

Os valores seguintes vêm do PDF v2.1 pp.11–12 e são estimativas históricas ainda úteis, não medições da stack React/NestJS. A versão completa é [recuperada no histórico](../../99-historico/pdf-v2.1/recuperados/documentacoes/infraestrutura/DIMENSIONAMENTO-VPS.md).

| Perfil | Envelope inicial proposto | Limite inicial do job | Condição |
|---|---|---|---|
| Mínimo | host/controle até 3 GB + execução até 3 GB + margem 2 GB | 2 vCPU / 3 GB / 256 PIDs / 30 min | repo pequeno e checks leves; subir perfil se não couber |
| Bom | host/controle 6 GB + execução 6 GB + margem 4 GB | 4 vCPU / 6 GB / 256 PIDs / 30 min | browser/checks/review sequenciais dentro do envelope |
| Ideal | host/controle até 8 GB; um job inicialmente | 4 vCPU / 8 GB inicialmente | plano antigo de dois jobs somente após ensaio; atual continua um executor |

No Bom, a decomposição antiga de 6 GB era SO 1,5 GB, controle/API/scheduler 1,5 GB, PostgreSQL 1,5 GB, Redis 0,5 GB, supervisor/observabilidade 1 GB. A distribuição deve ser medida e ajustada à stack real; não usar como configuração final de banco. Overhead do kernel/cache entra no orçamento agregado.

Exemplo histórico de disco de 200 GB: SO/ferramentas 25 GB, imagens/caches 55 GB, worktrees/dependências temporárias 45 GB, persistentes 15 GB, logs/artefatos 20 GB, margem livre 40 GB. Espaço anunciado não é espaço útil; limitar retenção/cache/workspaces e verificar backup externo antes de limpar. Prune indiscriminado não é permitido.

Preferir Linux 64 bits mantido; x86_64 reduz incerteza dos binários, ARM exige prova própria. Compatibilidade/toolchains do piloto são verificadas sem assumir PHP ou qualquer stack antiga da fábrica. Swap não substitui RAM; GPU/GUI completa não são requisitos. Browser headless apenas quando necessário. Rede/tráfego de imagens/builds/artifacts precisa de medição.

Ao selecionar capacidade no ambiente autorizado, registrar vCPU compartilhada/dedicada, CPU sustentada, IOPS/latência, espaço útil, virtualização/perfil forte, acesso administrativo, upgrade, tráfego e custo de renovação/backup. Nenhum fornecedor/preço foi aprovado. RAM amplia margem, não quota de IA ou disponibilidade. Se CPU saturar e fila/latência piorarem, avaliar mais CPU somente após dados; se OOM, RAM/perfil; se disco, retenção/armazenamento. Não diminuir isolamento para caber.
