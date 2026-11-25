"use client";

import { useActionState, useState } from "react";

import {
  resendInvitation,
  type ResendInvitationState,
} from "./actions";

export function ResendInvitationForm({ teacherId }: { teacherId: string }) {
  const [state, action, pending] = useActionState<
    ResendInvitationState,
    FormData
  >(resendInvitation, {});
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={action} className="flex max-w-[320px] flex-col items-start gap-2">
      <input type="hidden" name="teacherId" value={teacherId} />
      <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
        {pending ? "Enviando…" : "Reenviar invitación"}
      </button>
      {state.error && (
        <p className="form-error text-xs" role="alert">
          {state.error}
        </p>
      )}
      {state.link && (
        <div className="w-full space-y-2">
          <p className="form-ok text-xs" role="status">
            {state.delivery === "sent"
              ? "Invitación reenviada."
              : "No se pudo enviar. Copia el enlace:"}
          </p>
          <input
            readOnly
            value={state.link}
            aria-label="Nuevo enlace de invitación"
            onFocus={(event) => event.currentTarget.select()}
            className="field min-w-0 w-full text-xs"
          />
          <button
            type="button"
            onClick={copyLink}
            className="btn btn-secondary btn-sm"
          >
            {copied ? "Copiado" : "Copiar enlace"}
          </button>
        </div>
      )}
    </form>
  );
}
