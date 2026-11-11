"use client";

import { useActionState } from "react";

import { publish, type PublishResult } from "@/lib/actions/publish";

export function PublishForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<PublishResult, FormData>(publish, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Guardando…" : "Guardar nueva versión"}
      </button>

      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.version && (
        <p className="form-ok" role="status">
          Versión {state.version} guardada con {state.lessons} lecciones. Hash{" "}
          <span className="font-mono text-xs">{state.hash?.slice(0, 12)}</span>.
        </p>
      )}
    </form>
  );
}
