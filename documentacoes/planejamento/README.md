# Planejamento atual

FAC-000 está DONE. O piloto externo foi adiado por decisão do responsável até o núcleo da plataforma estar pronto para validação.

FAC-001A, FAC-002 a FAC-009, FAC-010A/B/C, FAC-011A/B/C/D, FAC-003A, FAC-012A/B e OPS-001 estão DONE. O workflow ainda não está ligado ao consumer real. FAC-010 permanece `WAITING_PROVIDER`. O projeto externo continua indefinido e o ensaio FAC-012 permanece adiado.

FAC-012C está implementado em `a8f7a66dfc1b5c58a0596611dc300559504709ce` e aguarda aceite humano. Impõe caminhos graváveis explícitos no `SandboxRunner`, mas não ativa nem confina ainda a escrita do agente via CLI.

FAC-012E está READY para expor ao worker uma leitura interna, versionada e sem segredos das contas/modelos configurados pela interface. O consumer permanece fora deste incremento.

Resultados de fixtures sintéticas comprovam contratos e infraestrutura da fábrica, mas não contam como entrega ou aceite do piloto externo.
