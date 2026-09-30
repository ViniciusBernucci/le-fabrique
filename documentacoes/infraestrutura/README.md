# Infraestrutura atual

Status: IMPLEMENTADO localmente em FAC-000; implantação em VPS NÃO REALIZADA.

## Componentes

- `web`: React/Vite compilado e servido por Nginx, que encaminha `/api` para a API.
- `api`: NestJS com validação de ambiente, Prisma e health checks para PostgreSQL e Redis.
- `worker`: processo Node.js separado com BullMQ e concorrência inicial igual a 1.
- `postgres`: persistência relacional com migration inicial para projetos, tickets e outbox.
- `redis`: fila interna do worker e verificação de prontidão da API.

Na composição completa, apenas a porta 8080 do Nginx é publicada. Os demais serviços usam redes internas e volumes nomeados. Os containers de aplicação usam filesystem somente leitura, `tmpfs` e `no-new-privileges`.

## Variáveis e execução

`.env.example` atende ao desenvolvimento local. `.env.production.example` documenta as variáveis da composição completa e contém apenas valores sintéticos, que precisam ser trocados antes de qualquer implantação.

```bash
cp .env.production.example .env
docker compose config
docker compose up -d --build
```

Verifique `GET http://localhost:8080/api/health/live` e `GET http://localhost:8080/api/health/ready`. Para interromper o ambiente sem apagar dados, execute `docker compose down`. A remoção de volumes não faz parte do rollback padrão.

Provisionamento, HTTPS, firewall, backup externo, restauração, isolamento de clientes oficiais e limites reais da VPS continuam sujeitos aos tickets de infraestrutura do MVP.
