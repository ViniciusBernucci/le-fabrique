# Checkout confiável mantém credenciais fora do projeto

Um checkout de repositório externo precisa acontecer no supervisor confiável, antes de entregar a árvore ao sandbox do agente. O destino deriva de UUIDs validados sob um root privado, e a referência é um SHA exato — nunca um caminho ou branch fornecido pelo prompt. Hosts permitidos vêm de configuração operacional exata; URL não pode carregar credenciais.

No FAC-012J, o worker comprova `tokenSource=keyring` pelo `gh auth status` antes de obter um token efêmero do cliente oficial. A autenticação Git fica num cabeçalho host-scoped somente no ambiente do processo Git; não aparece em argv, remote URL, stdout/stderr, job nem API. O processo Git ignora configurações globais/sistêmicas, hooks e protocolos locais. Clone sem checkout seguido de fetch e checkout detached reduz efeitos do repositório antes da revisão. Falha/timeout remove apenas o diretório temporário criado e nunca declara checkout concluído por exit code isolado: o SHA resolvido precisa ser igual ao snapshot.

Limite remanescente deste exemplo do repositório: o módulo ainda não está conectado ao consumidor e não foi executado com Git/GH/keyring reais ou identidade systemd; não liberar o writer com base somente nos testes sintéticos.

Referências: [relatório FAC-012J](../documentacoes/infraestrutura/2026-10-02-FAC-012J-checkout-confiavel-worker.md), `apps/worker/src/repository-checkout.ts`.
