"use client";

import { useActionState } from "react";

import { createTeacher, type CreateTeacherState } from "./actions";

export function CreateTeacherForm() {
  const [state, action, pending] = useActionState<CreateTeacherState, FormData>(createTeacher, {});

  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-3">
      <input
        name="name"
        required
        placeholder="Nombre"
        aria-label="Nombre"
        className="field"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="correo@ejemplo.com"
        aria-label="Correo"
        className="field"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Contraseña (8+)"
        aria-label="Contraseña"
        className="field"
      />

      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Creando…" : "Crear maestro"}
        </button>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="form-ok" role="status">
            Maestro creado.
          </p>
        )}
      </div>
    </form>
  );
}
