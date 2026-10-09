import type { ProviderInstallation } from "@le-fabrique/contracts";
import { installationProviderLabel } from "./settings-view-model";

export function AgentModelSelector({
  installations,
  installationId,
  model,
  onChange,
}: {
  installations: ProviderInstallation[];
  installationId: string | null;
  model: string | null;
  onChange: (selection: { installationId: string | null; model: string | null }) => void;
}) {
  const available = installations.filter((item) => item.enabled);
  const selected = available.find((item) => item.id === installationId);
  return (
    <>
      <label>
        IA do agente
        <select
          value={selected?.id ?? ""}
          onChange={(event) => {
            const account = available.find((item) => item.id === event.target.value);
            onChange({
              installationId: account?.id ?? null,
              model: account?.defaultModel ?? account?.models[0] ?? null,
            });
          }}
        >
          <option value="">Selecione uma IA cadastrada</option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · {installationProviderLabel(item)} ·{" "}
              {item.authMode === "API_KEY" ? "API" : "Assinatura CLI"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Modelo da IA
        <select
          value={model ?? ""}
          disabled={!selected || selected.models.length === 0}
          onChange={(event) => onChange({ installationId, model: event.target.value || null })}
        >
          <option value="">Selecione um modelo</option>
          {selected?.models.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      {available.length === 0 && (
        <p className="muted">Cadastre e habilite uma integração de IA para atribuí-la ao agente.</p>
      )}
      {selected && selected.models.length === 0 && (
        <p className="muted">Configure os modelos desta IA em Integrações IA.</p>
      )}
    </>
  );
}
