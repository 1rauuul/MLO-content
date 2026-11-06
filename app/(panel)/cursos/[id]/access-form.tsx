"use client";

import { useActionState } from "react";

import { grantCourseAccess, type AccessResult } from "@/lib/actions/access";

export function GrantAccessForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<AccessResult, FormData>(
    grantCourseAccess,
    {},
  );

  return (
    <form action={action} className="mt-4 flex flex-wrap items-start gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input
        name="externalKey"
        required
        placeholder="UUID del alumno"
        aria-label="Identidad externa del alumno"
        className="field min-w-64 flex-1 font-mono text-xs"
      />
      <input
        name="name"
        required
        placeholder="Nombre del alumno"
        aria-label="Nombre del alumno"
        className="field min-w-48 flex-1"
      />
      <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
        {pending ? "Concediendo…" : "Conceder acceso"}
      </button>
      {state.error && (
        <p className="form-error w-full" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="form-ok w-full" role="status">
          Acceso concedido.
        </p>
      )}
    </form>
  );
}
