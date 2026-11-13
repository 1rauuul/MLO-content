"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="field-label">
        Correo
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="field"
        />
      </label>
      <label className="field-label">
        Contraseña
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="field"
        />
      </label>

      {state.error && (
        <p id="login-error" className="form-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
