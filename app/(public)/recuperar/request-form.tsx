"use client";

import Link from "next/link";
import { useActionState } from "react";

import { RequiredMark } from "@/app/(panel)/required-mark";

import { requestReset, type RequestResetState } from "./actions";

export function RequestResetForm() {
  const [state, action, pending] = useActionState<RequestResetState, FormData>(
    requestReset,
    {},
  );

  if (state.ok) {
    return (
      <div className="mt-6 space-y-4">
        <p className="form-ok" role="status">
          Si el correo está registrado, recibirás un enlace para restablecer tu
          contraseña.
        </p>
        <p className="text-xs leading-relaxed text-ink-muted">
          Revisa también la carpeta de spam. Por seguridad, no confirmamos si el
          correo existe.
        </p>
        <Link href="/login" className="btn btn-secondary w-full">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <label className="field-label">
        <span>
          Correo <RequiredMark />
        </span>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="tu@correo.com"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "reset-request-error" : undefined}
          className="field"
        />
      </label>

      {state.error && (
        <p id="reset-request-error" className="form-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>

      <p className="text-center text-xs text-ink-faint">
        <Link href="/login" className="link">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
