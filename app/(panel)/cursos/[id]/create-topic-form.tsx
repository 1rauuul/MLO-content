"use client";

import { useActionState } from "react";

import { createTopic, type ActionResult } from "@/lib/actions/content";

export function CreateTopicForm({ courseId, unitId }: { courseId: string; unitId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createTopic, {});

  return (
    <form action={action} className="mt-3 flex flex-wrap items-start gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="unitId" value={unitId} />
      <input
        name="title"
        required
        placeholder="Título del subtema"
        aria-label="Título del subtema"
        className="field min-w-48 flex-1"
      />
      <input
        name="summary"
        placeholder="Resumen (opcional)"
        aria-label="Resumen del subtema"
        className="field min-w-48 flex-1"
      />
      <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
        {pending ? "Creando…" : "Crear subtema"}
      </button>
      {state.error && (
        <p className="form-error w-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
