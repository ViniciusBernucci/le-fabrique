# Pendências e limites da integração

| Pendência | Evidência faltante | Ação no repo real |
|---|---|---|
| Código da aplicação | Manifests, src, migrations, CI, versões e revisão | Inventariar; completar caminhos/estado por módulo |
| ADR-001 / colisões de IDs | Registro real de ADR/FAC/LF-MT | Procurar e preservar IDs; mapear alias quando colidir |
| API v2/v3 | Controller/OpenAPI/DTO de POST runs e auth errors | Confirmar rota única e convenção 403/404 |
| Workflow detalhado | Enum/transições por Ticket/Run | Confirmar estados laterais e owner; não criar enums por documento |
| Compatibilidade provider | Ponte oficial de tools, config/versão/cancel | Preflight; incompatible permanece disabled |
| Piloto/VPS | Repo/ref, acesso/specs, baseline, planos/capacidade | Completar contrato, sem compra/deploy presumidos |
| Implementação tenancy | Schema/roles/pool/RLS/ACL/perfis reais | Gates SEC e evidência por controle |
| Handoff e backup | Quiescência/restore/retention reais | Ensaiar em ambiente autorizado, medir RPO/RTO |
| Carregamento guias | Versão/superfície/override/mode | Testar leitura e fallback explícito |
| Fontes históricas | Planos/modos/condições/capabilities atuais | Revalidar antes de habilitar, sem herdar fatos de setembro |
| Kit v1 e docs ausentes | Referidos pela matriz, não fornecidos separadamente | Localizar no repo real; não afirmar conteúdo não lido |

As lacunas não impedem a reorganização do material disponível. Elas impedem apresentar contratos/controle como implementados ou executar migração de código/produção com base no pacote.
