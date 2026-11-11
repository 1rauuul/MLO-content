"use client";

import { useActionState } from "react";

import { createTopic, type ActionResult } from "@/lib/actions/content";

export function CreateTopicForm({ courseId, unitId }: { courseId: string; unitId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createTopic, {});

  return (
    <form
      action={action}
      className="mt-4 grid w-full max-w-3xl gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_auto] sm:items-end"
    >
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="unitId" value={unitId} />
      <input
        name="title"
        required
        placeholder="Título del subtema"
        aria-label="Título del subtema"
        className="field min-w-0"
      />
      <input
        name="summary"
        placeholder="Resumen (opcional)"
        aria-label="Resumen del subtema"
        className="field min-w-0"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-sm w-full shadow-[var(--shadow-card)] sm:w-auto"
      >
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
