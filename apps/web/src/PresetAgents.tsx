import type { EmployeeRole, FactoryConfiguration } from "@le-fabrique/contracts";
import { useEffect, useId, useRef, useState } from "react";
import { roleLabels } from "./settings-view-model";

const roleInformation: Record<EmployeeRole, { purpose: string; flow: string; status: string }> = {
  PLANNER: {
    purpose:
      "Organiza o objetivo do ticket, define o plano de trabalho e identifica caminhos, critérios e verificações necessários.",
    flow: "Atua no planejamento, antes da implementação, para orientar o Developer e estabelecer o que será revisado.",
    status:
      "A função está disponível para configuração; o fluxo atual ainda não invoca o Planner automaticamente.",
  },
  DEVELOPER: {
    purpose:
      "Implementa o ticket no workspace permitido, seguindo o objetivo, as instruções do projeto e os limites aprovados.",
    flow: "Executa a implementação e as correções permitidas. O worker coordena os checks e encaminha o resultado ao Reviewer.",
    status:
      "Integrado ao fluxo atual. A execução exige conta e modelo elegíveis, permissões e autorização do ticket.",
  },
  REVIEWER: {
    purpose:
      "Revisa a implementação, compara o resultado com os critérios e aponta problemas que precisam de correção.",
    flow: "Recebe o resultado após a implementação e os checks. Sua revisão pode solicitar correções ou liberar a próxima etapa de validação.",
    status:
      "Integrado ao fluxo atual, com revisão somente leitura. A revisão não substitui o aceite humano da entrega.",
  },
  QA: {
    purpose:
      "Avalia cenários de uso, resultados esperados e possíveis regressões para ajudar a verificar a qualidade da entrega.",
    flow: "Sua responsabilidade é validar o comportamento após a implementação e apoiar a análise dos resultados de testes.",
    status:
      "O worker já executa os checks configurados; este agente QA ainda não é invocado automaticamente no fluxo atual.",
  },
  DOCUMENTATION: {
    purpose:
      "Organiza a documentação da mudança, o funcionamento, as evidências, as limitações e as orientações de operação.",
    flow: "Apoia a documentação da implementação e da entrega antes da revisão e do aceite final.",
    status:
      "O fluxo atual exige documentação e verifica seus artefatos; este agente ainda não é invocado automaticamente.",
  },
  SECURITY: {
    purpose:
      "Analisa riscos relacionados a permissões, acesso a arquivos, credenciais e operações propostas pela implementação.",
    flow: "Sua responsabilidade é apoiar a revisão de segurança antes de aprovar operações e entregar a mudança.",
    status:
      "As proteções do worker já são aplicadas; este agente ainda não é invocado automaticamente. Ativá-lo não altera essas proteções.",
  },
};

export function PresetAgents({
  configuration,
  saving,
  onSave,
  onConfigure,
  configuring,
}: {
  configuration: FactoryConfiguration;
  saving: boolean;
  onSave: (configuration: FactoryConfiguration) => Promise<boolean>;
  onConfigure: (role: EmployeeRole) => void;
  configuring: boolean;
}) {
  const [selected, setSelected] = useState<EmployeeRole | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const wasConfiguring = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!selected) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [selected]);
  useEffect(() => {
    if (wasConfiguring.current && !configuring) trigger.current?.focus();
    wasConfiguring.current = configuring;
  }, [configuring]);
  async function toggle(role: EmployeeRole, enabled: boolean) {
    setError("");
    const saved = await onSave({
      ...configuration,
      assignments: configuration.assignments.map((agent) =>
        agent.role === role ? { ...agent, enabled } : agent,
      ),
    });
    if (!saved) setError("Não foi possível alterar o agente. Recarregue se a configuração mudou.");
  }
  return (
    <>
      <div className="account-list preset-agent-list">
        {configuration.assignments.map((agent) => (
          <div className="preset-agent-row" key={agent.role}>
            <button
              type="button"
              className="account-list-item"
              aria-label={`Ver agente ${roleLabels[agent.role]}`}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setSelected(agent.role);
              }}
            >
              <span className="provider-mark">{roleLabels[agent.role].slice(0, 1)}</span>
              <span className="account-list-name">
                <strong>{roleLabels[agent.role]}</strong>
                <span className="account-list-detail">Agente pré-configurado</span>
                <span className="account-list-detail">
                  {agent.installationId && agent.model
                    ? `${configuration.installations.find((item) => item.id === agent.installationId)?.label} · ${agent.model}`
                    : "Conta e modelo ainda não configurados"}
                </span>
              </span>
            </button>
            <label className="preset-agent-toggle">
              <input
                type="checkbox"
                role="switch"
                aria-checked={agent.enabled}
                aria-label={`Ativar agente ${roleLabels[agent.role]}`}
                checked={agent.enabled}
                disabled={saving}
                onChange={(event) => void toggle(agent.role, event.target.checked)}
              />
              <span>{agent.enabled ? "Ativo" : "Inativo"}</span>
            </label>
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {selected && (
        <dialog
          ref={dialog}
          className="account-dialog agent-overview"
          aria-labelledby={titleId}
          onCancel={() => setSelected(null)}
        >
          <div className="account-dialog-heading">
            <h2 id={titleId}>{roleLabels[selected]}</h2>
            <button
              type="button"
              aria-label="Fechar informações do agente"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>
          <h3>Função do agente</h3>
          <p>{roleInformation[selected].purpose}</p>
          <h3>Participação no fluxo</h3>
          <p>{roleInformation[selected].flow}</p>
          <p className="security-note">{roleInformation[selected].status}</p>
          <div className="account-dialog-footer">
            <button type="button" className="secondary-action" onClick={() => setSelected(null)}>
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                dialog.current?.close();
                trigger.current?.focus();
                setSelected(null);
                onConfigure(selected);
              }}
            >
              Configurações do agente
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
