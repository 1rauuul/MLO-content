"use client";

import { useActionState } from "react";

import { createClass, type ClassResult } from "@/lib/actions/classes";

export function CreateClassForm() {
  const [state, action, pending] = useActionState<ClassResult, FormData>(createClass, {});

  return (
    <form action={action} className="card flex flex-wrap items-start gap-3 p-4">
      <input
        name="name"
        required
        maxLength={80}
        placeholder="Nombre de la clase (por ejemplo, Grupo A)"
        aria-label="Nombre de la clase"
        className="field min-w-60 flex-1"
      />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creando…" : "Crear clase"}
      </button>
      {state.error && (
        <p className="form-error w-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
