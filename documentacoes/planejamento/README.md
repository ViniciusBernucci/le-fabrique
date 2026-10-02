# Planejamento atual

FAC-000 está DONE. O piloto externo foi adiado por decisão do responsável até o núcleo da plataforma estar pronto para validação.

FAC-001A, FAC-002 a FAC-009, FAC-010A/B/C, FAC-011A/B/C/D, FAC-003A, FAC-012A/B e OPS-001 estão DONE. O workflow ainda não está ligado ao consumer real. FAC-010 permanece `WAITING_PROVIDER`. O projeto externo continua indefinido e o ensaio FAC-012 permanece adiado.

FAC-012C está implementado em `a8f7a66dfc1b5c58a0596611dc300559504709ce` e aguarda aceite humano. Impõe caminhos graváveis explícitos no `SandboxRunner`, mas não ativa nem confina ainda a escrita do agente via CLI.

FAC-012E implementa leitura interna versionada e sem segredos das contas/modelos configurados pela interface (`4aca1e1`) e aguarda aceite humano. O consumer permanece fora deste incremento.

FAC-012F implementado no commit `950f3b62651b1e918bae09d89996af0d95e9fbee`; aguarda aceite humano. Resolve Developer/Reviewer da configuração atual sem cache/fallback, mas ainda não está conectado ao consumer nem executa adapters.

FAC-012G implementado após a base `03d7a9b` e aguarda aceite humano. O workflow consulta rotas Developer/Reviewer independentemente, sem integrar a fila nem executar clientes.

FAC-012H implementado em branch isolada; aguarda revisão/aceite humano. O sandbox agora troca para uma raiz mínima e testes sintéticos bloqueiam leitura do host e tentativa de remontar o workspace.

FAC-012I está READY para configurar contexto e checks explicitamente aprovados por projeto, persistidos na definição versionada e exigidos antes de READY; nenhum consumer/provider será ligado.

Resultados de fixtures sintéticas comprovam contratos e infraestrutura da fábrica, mas não contam como entrega ou aceite do piloto externo.
