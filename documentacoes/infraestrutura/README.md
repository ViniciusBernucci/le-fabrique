# Infraestrutura atual

FAC-012C endurece o `SandboxRunner`: workspace read-only por padrão, com caminhos graváveis explícitos validados antes da execução. FAC-012H faz pivot para uma raiz mínima antes de iniciar checks: `/usr` fica read-only, workspace é montado em `/mnt`, e raiz antiga, home, `/run`, `/var` e `/sys` do host não ficam acessíveis. O processo roda sem capabilities e com `no-new-privileges`. Isso não confina o Developer CLI (FAC-012D separado) nem autoriza ativar o consumer real.

FAC-012J adiciona ao worker um preparador de checkout confiável que valida SHA, URL HTTPS/host allowlisted e grava diretórios privados por execução. Ele usa apenas credencial efêmera do `gh` oficial quando a origem de credenciais é `keyring`, desativa configuração Git do host, hooks, filtros não configurados, LFS/submódulos e protocolos locais, e não expõe a saída bruta. `WORKER_CHECKOUT_ROOT` e `WORKER_REPOSITORY_HOSTS` ainda não são ligados ao Compose nem ao consumer; configurar e validar Git/GH/keyring na identidade efetiva é trabalho operacional pendente.

OPS-005 move a localização suportada do processo worker para um serviço systemd dedicado no mesmo host: o `SandboxRunner` chama `systemd-run --user`, então o container Compose restrito não é um executor compatível. O Compose mantém o controle, banco e fila; API/Redis são publicados apenas em loopback para o worker host. O unit é fornecido como template, não instalado; `main.ts` não consome a fila de execução até que exista consumer real e gates próprios aceitos.

Status: bootstrap do FAC-000 e sandbox/snapshots do FAC-007 aceitos. Implantação em VPS NÃO REALIZADA.

## Componentes

- `web`: React/Vite compilado e servido por Nginx, que encaminha `/api` para a API.
- `api`: NestJS com validação de ambiente, Prisma e health checks para PostgreSQL e Redis.
- `worker`: processo Node.js/TypeScript separado, suportado como serviço host dedicado; não é iniciado pelo Compose.
- `postgres`: persistência relacional com migration inicial para projetos, tickets e outbox.
- `redis`: fila interna do worker e verificação de prontidão da API.

Na composição de controle, Nginx é publicado somente em `127.0.0.1:8080`; API e Redis somente em `127.0.0.1` para acesso local do serviço worker. PostgreSQL não tem porta publicada; os serviços usam redes internas e volumes nomeados. Os containers de aplicação usam filesystem somente leitura, `tmpfs` e `no-new-privileges`.

## Variáveis e execução

`.env.example` atende ao desenvolvimento local. `.env.production.example` documenta somente Compose/control plane e contém valores sintéticos. O worker host recebe configuração de `/etc/le-fabrique/worker.env`, nunca versionada; o exemplo está em `infrastructure/systemd/worker.env.example`.

O bootstrap local atual e:

```bash
cp .env.example .env
docker compose -f compose.dev.yaml up -d
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

O launcher raiz carrega `.env` antes de iniciar os tres workspaces. O painel usa `VITE_API_URL=/api` e o proxy do Vite, evitando que um browser remoto interprete `localhost` como a propria maquina. `db:deploy` aplica migrations existentes; `db:migrate` e reservado a autoria de uma nova migration e nao faz parte de um simples start.

```bash
cp .env.production.example .env
docker compose config
docker compose up -d --build
```

Esse comando não inicia o worker. Para futura ativação manual, após ticket de integração e gates operacionais aceitos, provisionar usuário `le-fabrique-worker`, instalar Node/Git/GH e cliente(s) oficial(is) por fonte/verificação apropriada, configurar keyring sob essa identidade, preparar `/opt/le-fabrique` e `/etc/le-fabrique/worker.env`, habilitar user manager/linger, validar mounts/namespaces e só então instalar/ativar o unit. Este ticket não executa nenhum desses comandos nem autentica clientes. Verifique `GET http://localhost:8080/api/health/live` e `/ready`. Para interromper o controle sem apagar dados, execute `docker compose down`; a remoção de volumes não faz parte do rollback padrão.

Provisionamento, HTTPS, firewall, backup externo, restauração, isolamento de clientes oficiais e limites reais da VPS continuam sujeitos aos tickets de infraestrutura do MVP.

OPS-003 versiona uma migration que remove defaults PostgreSQL de UUID gerados pelo Prisma Client e renomeia o índice de verificações GitHub para refletir o schema. A migration ainda não foi aplicada a banco algum.

## Sandbox atual

FAC-007 implementa worktree detached, unidade systemd de usuario com cgroup e snapshot local com patch binario/untracked verificados por SHA-256. FAC-012H complementa os namespaces com raiz isolada: apenas runtime `/usr` somente leitura, workspace `/mnt`, `/proc` da execução, devices mínimos e temporários isolados são montados; raiz antiga é desanexada antes do processo não confiável iniciar. O supervisor confiavel continua fora do namespace para operar Git e artefatos. Integracao ao worker e persistencia pertencem ao FAC-008.

O checkout FAC-012J é materializado fora do sandbox, em root absoluto, privado (`0700`) e pertencente à identidade do worker. Antes da integração, o operador deverá provisionar esse root, definir uma lista de hosts DNS exatos (sem wildcard/IP/porta), instalar versões compatíveis de `git` e `gh` por fonte oficial e confirmar armazenamento `keyring` sob o mesmo usuário. A ausência de qualquer requisito deve manter execução indisponível. O consumer de ticket foi removido do processo padrão; fixture continua apenas em testes. O antigo Dockerfile.worker não constitui caminho de execução suportado.
