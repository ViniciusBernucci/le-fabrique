import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

export function SettingsModal({
  title,
  saving,
  onClose,
  onSave,
  children,
}: {
  title: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="account-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (saving) event.preventDefault();
        else onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="account-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="secondary-action"
            disabled={saving}
            onClick={onClose}
            aria-label="Fechar configuração"
          >
            ×
          </button>
        </div>
        <fieldset disabled={saving}>{children}</fieldset>
        <div className="account-dialog-footer">
          <button type="button" className="secondary-action" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar configuração"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
