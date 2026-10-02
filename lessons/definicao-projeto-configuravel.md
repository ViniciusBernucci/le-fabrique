# Definicao de projeto e uma fronteira configuravel

## Conceito

Uma fabrica generica nao deve conhecer em codigo o projeto que desenvolvera. Repositorio/revisao identificam a fonte; descricao, stack, instrucoes, caminhos e checks formam uma definicao versionada; contas/modelos pertencem a outra configuracao; tickets descrevem incrementos. Misturar essas dimensoes cria hardcode e torna mudancas operacionais dependentes de deploy.

## Aplicacao no repositorio

No FAC-001A, `ProjectDefinition` e uma entidade um-para-um persistida separadamente de `FactorySettings`. O painel salva checks como `command` e `args`, nunca como linha de shell. `ControlService.markReady` exige definicao e grava sua versao no evento, enquanto a escolha de provider/modelo continua no Centro de Configuracoes.

## Cuidados

- Persistencia nao torna um comando seguro por si so; o worker ainda deve aplicar perfil/allowlist e isolamento.
- Versao otimista impede sobrescrita silenciosa, mas a execucao precisa conservar a versao associada ao evento.
- Definicao ausente deve continuar explicita; defaults sinteticos nao podem fingir que um projeto real foi inspecionado.
- Uma configuracao do piloto nao e feature nova: o piloto futuro reutiliza o mesmo fluxo de qualquer projeto.

No FAC-012A, apenas registrar `definitionVersion` mostrou-se insuficiente porque a tabela guarda a versao atual, nao o historico completo. A fronteira READY passou a copiar a definicao e o ticket para `executionSpecification` na outbox. Referencia de versao detecta divergencia; snapshot autocontido preserva o que realmente foi autorizado. Ambos sao necessarios quando o estado fonte permanece editavel.

## Referencias

- `documentacoes/planejamento/FAC-001A-definicao-projeto-configuravel.md`
- `documentacoes/controle/2026-10-02-FAC-001A-definicao-projeto-configuravel.md`
- Revisao funcional `148485ec5858756460b1db6f183c346854703981`
