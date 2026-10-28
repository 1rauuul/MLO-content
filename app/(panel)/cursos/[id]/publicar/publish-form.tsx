"use client";

import { useActionState } from "react";

import { publish, type PublishResult } from "@/lib/actions/publish";

export function PublishForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<PublishResult, FormData>(publish, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Publicando…" : "Publicar nueva versión"}
      </button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.version && (
        <p className="text-sm text-green-700">
          Versión {state.version} publicada con {state.lessons} lecciones. Hash{" "}
          <span className="font-mono text-xs">{state.hash?.slice(0, 12)}</span>.
        </p>
      )}
    </form>
  );
}
