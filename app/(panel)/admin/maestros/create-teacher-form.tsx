"use client";

import { useActionState, useState } from "react";

import { createTeacher, type CreateTeacherState } from "./actions";
import { RequiredMark } from "@/app/(panel)/required-mark";

export function CreateTeacherForm() {
  const [state, action, pending] = useActionState<CreateTeacherState, FormData>(
    createTeacher,
    {},
  );
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

  const deliveryMessage = state.link
    ? state.delivery === "sent"
      ? `Invitación enviada a ${state.email ?? "el correo"}.`
      : state.delivery === "not_configured"
        ? "La invitación quedó creada, pero falta configurar el proveedor de correo. Comparte este enlace:"
        : state.delivery === "rejected"
          ? "El proveedor rechazó el envío. Comparte este enlace:"
          : "No se pudo conectar con el proveedor de correo. Comparte este enlace:"
    : null;

  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-2">
      <label className="field-label">
        <span>
          Nombre <RequiredMark />
        </span>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Nombre"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "teacher-form-error" : undefined}
          className="field"
        />
      </label>
      <label className="field-label">
        <span>
          Correo <RequiredMark />
        </span>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="correo@ejemplo.com"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "teacher-form-error" : undefined}
          className="field"
        />
      </label>

      <p className="text-sm text-ink-muted sm:col-span-2">
        El maestro recibirá una invitación por correo y creará su propia contraseña.
      </p>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Enviando…" : "Enviar invitación"}
        </button>
        <span className="text-xs text-ink-faint">* Campo obligatorio</span>
        {state.error && (
          <p id="teacher-form-error" className="form-error" role="alert">
            {state.error}
          </p>
        )}
      </div>

      {state.link && deliveryMessage && (
        <div className="space-y-2 sm:col-span-2">
          <p className="form-ok" role="status">
            {deliveryMessage}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={state.link}
              aria-label="Enlace de invitación"
              onFocus={(event) => event.currentTarget.select()}
              className="field min-w-0 flex-1 text-xs"
            />
            <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm">
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
