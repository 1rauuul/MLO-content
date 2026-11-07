"use client";

import { useActionState } from "react";

import { publishClass, type PublishClassResult } from "@/lib/actions/classes";

export function PublishClassForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState<PublishClassResult, FormData>(
    publishClass,
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="classId" value={classId} />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Publicando…" : "Publicar grupo"}
      </button>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="form-ok" role="status">
          Versión {state.version} publicada con {state.extras}{" "}
          {state.extras === 1 ? "contenido" : "contenidos"}. Hash{" "}
          <span className="font-mono text-xs">{state.hash?.slice(0, 12)}</span>.
          {state.v3Version && (
            <>
              {" "}Release v3 {state.v3Version} ·{" "}
              <span className="font-mono text-xs">{state.v3Hash?.slice(0, 12)}</span>.
            </>
          )}
        </p>
      )}
    </form>
  );
}
