# Edição em modal com rascunho separado

FAC-013 em SettingsPanel.tsx mantém editingInstallation separado de draft. Abrir usa structuredClone; editar não muda a linha ou referências de funções. Cancelar/Escape descarta o clone e conta nova só entra na lista após persistência bem-sucedida. saveInstallation reconcilia catálogo e atribuições antes da API versionada; só fecha após retorno positivo, preservando entrada quando a requisição falha.

Dialog nativo aberto por showModal fornece foco modal/fundo inerte pelo browser; aria-labelledby identifica o formulário. O estado saving bloqueia cancelamento e campos durante a requisição. A validação automatizada existente cobre build/tipos/view models, mas foco, Escape e retorno do foco ainda requerem prova de interação no navegador. Não confundir renderização estática com essa prova.

[Implementação e evidências](../documentacoes/configuracao/2026-10-05-FAC-013-modal-contas-ia.md).

FAC-014 extrai SettingsModal com título por useId e cleanup do dialog, reutilizado nas três seções. editingAssignment/editingGithub isolam campos do draft global; ações de integração/PR continuam independentes do cancelamento do formulário. Fechar um modal descarta configuração local, mas não é rollback de pedidos já enviados ao worker. [Evidências](../documentacoes/configuracao/2026-10-05-FAC-014-modais-funcionarios-github.md).

FAC-016: mensagens globais podem ficar atrás do dialog nativo. SettingsPanel mantém envio/erros no modal com role=status/alert e traduz resultado por estado em providerVerificationFeedback. Confirmar API/worker separadamente evita tratar falha operacional como clique perdido. Atualização de código pelo watcher não recarrega ambiente herdado do supervisor; a causa conhecida deve ter orientação fixa sem expor erro bruto.
