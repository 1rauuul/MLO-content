"use client";

import { useFormStatus } from "react-dom";

import { ResultDialog } from "./result-dialog";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn btn-danger-solid btn-sm">
      {pending ? "Eliminando…" : label}
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  action,
  hiddenFields,
  confirmLabel = "Eliminar",
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  confirmLabel?: string;
  onClose: () => void;
}) {
  async function submit(formData: FormData) {
    await action(formData);
    onClose();
  }

  return (
    <ResultDialog
      open={open}
      title={title}
      onClose={onClose}
      centered
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cancelar
          </button>
          <form action={submit}>
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <SubmitButton label={confirmLabel} />
          </form>
        </>
      }
    >
      {description}
    </ResultDialog>
  );
}
