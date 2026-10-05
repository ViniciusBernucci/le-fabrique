# Baseline, regressao e review sao sinais diferentes

FAC-012Q adiciona gate administrativo real: `RunDeliveryService` cruza checks aprovados congelados com baseline/pós e exige report APPROVE, chamadas concluídas, checkpoint parado e artefato íntegro. Flag preExisting sem falha da baseline não passa. Documento determinístico registra limites; humano aceita digest exato que vincula resultado/bundle/documento, nunca só SHA HEAD (patch não commitado não muda HEAD). Replay aceito não duplica versões, outro conteúdo invalida aceite.

Um check vermelho depois da alteracao nao prova regressao se o mesmo check ja falhava na revisao-base. No FAC-009, cada comando confiavel roda antes do Developer e depois de cada rodada; o resultado posterior recebe `preExisting=true` somente pelo mesmo nome de check. Falha nova bloqueia review, enquanto falha anterior permanece visivel para decisao humana.

Exit code zero do cliente tambem nao prova o ticket. O coordenador exige runtime concluido, ausencia de regressao e veredito JSON valido de uma segunda execucao `READ_ONLY`. Mesmo `APPROVE` produz `AWAITING_HUMAN`, preservando o aceite humano da revisao exata.

Quiescencia precede classificacao. Se o SandboxRunner nao confirma que um baseline ou check posterior terminou, o fluxo retorna `CHECK_UNQUIESCED` antes de abrir Developer, capturar snapshot ou iniciar correcao. Uma falha conhecida nao autoriza dois processos concorrentes.

Comandos de check pertencem ao request confiavel e entram como argv; mensagens do Developer ou Reviewer nunca se tornam shell. Os testes em `apps/worker/src/developer-workflow.spec.ts` usam portas sinteticas e comprovam baseline preexistente, regressao corrigida, review invalido, limite de tentativas e falha repetida.

FAC-012Z distingue presença/estrutura e verdade técnica: `documentation-gate.ts` valida documentos alterados/seguros, seções e referências mínimas, publicando hashes vinculados ao snapshot. `DeveloperWorkflow` exige Reviewer independente sobre conteúdo e recaptura após review para impedir aprovação de diff mutado. `RunDeliveryService` cruza conjunto obrigatório e manifesto final antes do aceite; PASS estrutural não declara critérios semanticamente cobertos.

OPS-008 encontrou `/health/ready` saudável porque `HealthService.checkDatabase` só consulta SELECT 1, enquanto faltavam tabelas usadas pela aplicação. `scripts/db.test.mjs` confirma propagação de ambiente em subprocesso real; `db:status` no banco existente demonstra o diagnóstico de migrations, sem chamar erro de schema antigo de regressão da UI. Histórico Prisma divergente e tentativas sem stop são evidências a reconciliar, não justificativa para reset ou fabricação de parada. [Relatório](../documentacoes/infraestrutura/2026-10-05-OPS-008-bootstrap-migrations-telas.md).
