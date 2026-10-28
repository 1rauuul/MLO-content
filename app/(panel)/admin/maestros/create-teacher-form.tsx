"use client";

import { useActionState } from "react";

import { createTeacher, type CreateTeacherState } from "./actions";

export function CreateTeacherForm() {
  const [state, action, pending] = useActionState<CreateTeacherState, FormData>(createTeacher, {});

  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-3"
    >
      <input
        name="name"
        required
        placeholder="Nombre"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="correo@ejemplo.com"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Contraseña (8+)"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />

      <div className="flex items-center gap-3 sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear maestro"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700">Maestro creado.</p>}
      </div>
    </form>
  );
}
