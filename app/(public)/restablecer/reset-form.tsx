"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { PasswordRequirements } from "@/app/(public)/password-requirements";
import { validatePassword } from "@/lib/password-policy";

import { resetPassword, type ResetPasswordState } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    {},
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const policy = validatePassword(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = policy.valid && password === confirm && confirm.length > 0;

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <label className="field-label">
        <span>Nueva contraseña</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-requirements"
          className="field"
        />
      </label>
      <div id="password-requirements">
        <PasswordRequirements value={password} />
      </div>

      <label className="field-label">
        <span>Confirmar contraseña</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={mismatch}
          className="field"
        />
      </label>
      {mismatch && (
        <p className="form-error" role="alert">
          Las contraseñas no coinciden.
        </p>
      )}

      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="btn btn-primary"
      >
        {pending ? "Restableciendo…" : "Restablecer contraseña"}
      </button>

      <p className="text-center text-xs text-ink-faint">
        ¿Necesitas otro enlace?{" "}
        <Link href="/recuperar" className="link">
          Solicítalo de nuevo
        </Link>
      </p>
    </form>
  );
}
