"use client";

import { useActionState } from "react";

import { createEvaluation, type TopicResult } from "@/lib/actions/topics";

export function CreateEvaluationForm({
  courseId,
  topicId,
}: {
  courseId: string;
  topicId: string;
}) {
  const [state, action, pending] = useActionState<TopicResult, FormData>(
    createEvaluation,
    {},
  );

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-line pt-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <div className="grid gap-3">
        <label className="field-label">
          Título
          <input
            name="title"
            required
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "evaluation-form-error" : undefined}
            className="field"
          />
        </label>
        <label className="field-label">
          Descripción
          <input name="description" className="field" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Creando…" : "Crear evaluación"}
        </button>
        {state.error && <p id="evaluation-form-error" className="form-error" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}
