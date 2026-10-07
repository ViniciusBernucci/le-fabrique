# Fábrica de Software — pacote de reorganização documental

Este pacote contém a documentação reorganizada do espelho disponível, instruções permanentes e roteiro para integrar no repositório real. Não é uma implementação da aplicação. Os originais em sources/ e o pacote anterior foram preservados integralmente.

Comece pelo [guia de instalação](GUIA-DE-INTEGRACAO.md), leia o [Manual Vivo](docs/README.md) e execute o [prompt mestre](prompts/PROMPT-MESTRE-MIGRACAO.md) no repositório da aplicação. O [índice completo](docs/INDEX.md) permite localizar cada arquivo.

O sistema planejado usa React + NestJS + worker Node/TypeScript, PostgreSQL, Redis e uma VPS Linux. Laravel/Angular são histórico. A proposta multi-tenant permanece planejada e depende de validação de isolamento por provider.

Não copie este README sobre o README real sem mesclar instruções de instalação/testes que já existam. Arquivos de governança de raiz também devem ser integrados, preservando regras locais.
