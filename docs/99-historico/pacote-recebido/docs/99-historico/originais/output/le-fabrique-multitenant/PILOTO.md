# Contrato do piloto
Status: PLANEJADO — completar antes de execução.
- Repositório/acesso, base branch/SHA: A DEFINIR.
- Funcionalidade pequena e critérios verificáveis: A DEFINIR.
- Stack/versões/checks/baseline: inspecionar repo real.
- Caminhos permitidos/proibidos: A DEFINIR.
- Infraestrutura: VPS única; perfil Bom recomendado 8 vCPU/16 GB/200 GB; perfil contratado A DEFINIR. Clientes oficiais autenticados na VPS; compatibilidade A VERIFICAR.
- Providers/planos/modos de autenticação/modelos: registrar no preflight real.
- Limites propostos: um writer, 30 min/tentativa, duas correções, dois handoffs.
- API: desativada; orçamento mensal zero. Extra usage/créditos/autorecharge: desativados nos fornecedores.
- Dados somente sintéticos; sem merge/deploy automático.
Preferir filtro, validação ou exibição num módulo existente com testes. Excluir autenticação/pagamento/migração irreversível na primeira amostra. Não assumir qual sistema será usado; pode ser escolhido pelo responsável.


## Extensão v3 proposta — 2026-10-06

Data: 2026-10-06 (America/Sao_Paulo). Status da arquitetura e controles: **PLANEJADO**. Implementação e eficácia: **NÃO VERIFICADAS**. Este documento especifica trabalho futuro; não comprova instalação, configuração ou execução.
Adicionar antes da execução: tenant e project ownership reais; memberships/grants; provider installation do mesmo tenant e preflight com tools exclusivamente mediadas; hashes de policy/image/config; perfil de isolamento autorizado; SEC aplicáveis; workspace/sessão efêmeros sem auth; egress definido; kill switch/backup/rollback. A/B e A1/A2 são fixtures de segurança, não clientes reais. FAC-002 execução assistida aguarda gate LF-MT-08/09. Container comum restrito a código próprio/dados sintéticos.
