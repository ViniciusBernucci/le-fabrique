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
