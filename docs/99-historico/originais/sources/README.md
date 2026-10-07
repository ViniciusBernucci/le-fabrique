# Fábrica de Software — kit v2.1
29/09/2026. Planejamento completo: web na VPS, worker interno na VPS, clientes oficiais e assinaturas primeiro. APIs e créditos extras desligados no MVP. Não há implementação neste pacote.
## Começar
1. Ler documentacoes/arquitetura/ARQUITETURA.md, FONTES.md e PLANO-MVP.md.
2. Preencher PILOTO.md e executar FAC-001/FAC-002 antes de bootstrap completo.
3. Mesclar AGENTS.md e CLAUDE.md com regras existentes; preservar escopos locais.
4. Antigravity: ler ANTIGRAVITY.md e confirmar como a versão carrega regras; injetar explicitamente quando necessário.
5. Seguir documentacoes/POLITICA-IA.md em toda entrega; usar templates.
## Conteúdo
Arquitetura, contratos, backlog, políticas, guias dos três agentes, runtime, handoff, operação, economia, templates e matriz de migração. Configuração example é política da fábrica a implementar, não configuração nativa dos fornecedores.
O PDF reúne todos os Markdown deste kit, inclusive guias e templates. Markdown é fonte editável; ao atualizar, regenerar PDF a partir da mesma revisão. O pacote preserva a cobertura do kit anterior, substituindo decisões incompatíveis com a v2.

## Infraestrutura do MVP
Toda a fábrica executa na mesma VPS. Bom recomendado: 8 vCPU, 16 GB RAM, 200 GB SSD/NVMe, um executor inicial. Ler documentacoes/infraestrutura/DIMENSIONAMENTO-VPS.md e ADR-002; mínimo/ideal e condições de escala documentados. Revisão 2.1 mantém os nomes dos arquivos para continuidade.
