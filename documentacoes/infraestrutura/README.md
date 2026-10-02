# Infraestrutura atual

Status: bootstrap do FAC-000 e sandbox/snapshots do FAC-007 aceitos. Implantação em VPS NÃO REALIZADA.

## Componentes

- `web`: React/Vite compilado e servido por Nginx, que encaminha `/api` para a API.
- `api`: NestJS com validação de ambiente, Prisma e health checks para PostgreSQL e Redis.
- `worker`: processo Node.js separado com BullMQ e concorrência inicial igual a 1.
- `postgres`: persistência relacional com migration inicial para projetos, tickets e outbox.
- `redis`: fila interna do worker e verificação de prontidão da API.

Na composição completa, a porta do Nginx é publicada somente em `127.0.0.1:8080`; um proxy HTTPS no host pode encaminhá-la sem expor diretamente a porta de origem. Os demais serviços usam redes internas e volumes nomeados. Os containers de aplicação usam filesystem somente leitura, `tmpfs` e `no-new-privileges`.

## Variáveis e execução

`.env.example` atende ao desenvolvimento local. `.env.production.example` documenta as variáveis da composição completa e contém apenas valores sintéticos, que precisam ser trocados antes de qualquer implantação.

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

Verifique `GET http://localhost:8080/api/health/live` e `GET http://localhost:8080/api/health/ready`. Para interromper o ambiente sem apagar dados, execute `docker compose down`. A remoção de volumes não faz parte do rollback padrão.

Provisionamento, HTTPS, firewall, backup externo, restauração, isolamento de clientes oficiais e limites reais da VPS continuam sujeitos aos tickets de infraestrutura do MVP.

OPS-003 versiona uma migration que remove defaults PostgreSQL de UUID gerados pelo Prisma Client e renomeia o índice de verificações GitHub para refletir o schema. A migration ainda não foi aplicada a banco algum.

## Sandbox atual

FAC-007 implementa worktree detached, unidade systemd de usuario com cgroup, namespaces Linux sem root e snapshot local com patch binario/untracked verificados por SHA-256. O comando enxerga o workspace como `/mnt`; home, `/run`, temporarios gravaveis e rede externa sao substituidos. O supervisor confiavel continua fora do namespace para operar Git e artefatos. Integracao ao worker e persistencia pertencem ao FAC-008.
