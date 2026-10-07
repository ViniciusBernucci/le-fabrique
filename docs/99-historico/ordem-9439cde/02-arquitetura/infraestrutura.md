> Integração DOC-MV-001: texto de direção/planejamento do pacote. O [AS-IS atual](as-is.md) prevalece para implementação. Não confundir proposta com controle instalado.

# Infraestrutura e implantação

Revisão documental: 2026-10-06 (America/Sao_Paulo). Arquitetura **PLANEJADA**; implementação e eficácia **NÃO VERIFICADAS** na origem do pacote.

Uma VPS Linux comporta controle, banco/fila, worker, runtimes e sandboxes separados logicamente. HTTPS público, SSH administrativo restrito, serviços internos privados. Inferência externa; GPU não é requisito. Um executor inicial; ampliar somente após medição.

O [dimensionamento canônico](../07-operacao/infraestrutura/dimensionamento-vps.md) preserva perfis e envelopes propostos; os valores não são benchmark da stack atual. [Deploy](../07-operacao/deploy.md) e [backup](../07-operacao/backup.md) descrevem operação futura. VPS contratada, OS/kernel e acesso permanecem pendentes. [ADR-002](../06-decisoes/ADR-002-vps-unica.md) registra a decisão de topologia.
