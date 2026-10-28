"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
        Correo
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
        Contraseña
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
