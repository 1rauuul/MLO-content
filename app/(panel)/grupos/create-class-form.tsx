"use client";

import { useActionState } from "react";

import { createClass, type ClassResult } from "@/lib/actions/classes";

export function CreateClassForm() {
  const [state, action, pending] = useActionState<ClassResult, FormData>(createClass, {});

  return (
    <form action={action} className="card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Nuevo grupo</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          El código de acceso se genera automáticamente.
        </p>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="field-label">
          Nombre del grupo
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Ej. UX · Grupo A"
            className="field"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full sm:w-auto"
        >
          {pending ? "Creando…" : "Crear grupo"}
        </button>
      </div>

      {state.error && (
        <p className="form-error px-5 pb-5" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
