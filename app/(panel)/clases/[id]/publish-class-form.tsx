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
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Publicando…" : "Publicar clase"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-green-700">
          Versión {state.version} publicada con {state.extras}{" "}
          {state.extras === 1 ? "contenido" : "contenidos"}. Hash{" "}
          <span className="font-mono text-xs">{state.hash?.slice(0, 12)}</span>.
        </p>
      )}
    </form>
  );
}
