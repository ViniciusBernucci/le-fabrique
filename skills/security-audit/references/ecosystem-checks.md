# Checks do monorepo e VPS

Inspecionar package.json e lockfile, scripts Node/TS, schemas Zod, Prisma/migrations, Docker Compose e worker/runtime. npm run lint/typecheck/test/build são checks existentes; escolher subset por workspace quando suficiente. Não usar db:deploy/db:migrate, provider setup/login ou preflight real como scanner automático.

npm audit/scanners/rede não são instalados/executados por rotina: precisam ser pertinentes e compatíveis com autorização/ambiente. Achado de dependência exige pacote/versão/config/exposição, sem inventar CVE ou resultado; evidência externa necessária segue verificação específica. Não executar hooks/scripts não inspecionados de contribuidor.

CI ausente não recebe PASS fictício. Guardar revisão/ambiente/command/output e limites. Piloto externo pode ter outra stack: inspecionar sua evidência e regras próprias em vez de aplicar padrões da fábrica ou ressuscitar contexto estrangeiro.
