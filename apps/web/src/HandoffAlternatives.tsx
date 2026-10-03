import type { AgentAssignment, ProviderInstallation } from "@le-fabrique/contracts";

export function HandoffAlternatives({
  assignment,
  installations,
  onChange,
}: {
  assignment: AgentAssignment;
  installations: ProviderInstallation[];
  onChange: (alternatives: NonNullable<AgentAssignment["alternatives"]>) => void;
}) {
  const alternatives = assignment.alternatives ?? [];
  return (
    <fieldset>
      <legend>Alternativas por assinatura</legend>
      <p>
        Selecionar autoriza handoff automático após parada e snapshot. Sem uso extra/API; até duas
        trocas na tentativa, respeitando também limites de chamadas/tempo.
      </p>
      {[0, 1].map((position) => {
        const selected = alternatives[position];
        return (
          <label key={position}>
            Prioridade {position + 1}
            <select
              value={selected ? `${selected.installationId}::${selected.model}` : ""}
              disabled={!assignment.installationId || (position === 1 && !alternatives[0])}
              onChange={(event) => {
                const next = [...alternatives];
                const [installationId, ...parts] = event.target.value.split("::");
                if (!installationId) next.splice(position);
                else next[position] = { installationId, model: parts.join("::") };
                onChange(next);
              }}
            >
              <option value="">Sem alternativa</option>
              {installations
                .filter(
                  (installation) =>
                    installation.enabled &&
                    installation.id !== assignment.installationId &&
                    !alternatives.some(
                      (alternative, index) =>
                        index !== position && alternative.installationId === installation.id,
                    ),
                )
                .flatMap((installation) =>
                  installation.models.map((model) => (
                    <option
                      key={`${installation.id}:${model}`}
                      value={`${installation.id}::${model}`}
                    >
                      {installation.label} · {model}
                    </option>
                  )),
                )}
            </select>
          </label>
        );
      })}
    </fieldset>
  );
}
