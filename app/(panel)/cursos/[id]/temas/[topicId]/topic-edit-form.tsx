"use client";

import { useActionState } from "react";

import { updateTopic, type ActionResult } from "@/lib/actions/content";

export function TopicEditForm({
  courseId,
  topic,
}: {
  courseId: string;
  topic: { id: string; title: string; summary: string };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateTopic, {});

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topic.id} />
      <label className="field-label">
        Título
        <input
          name="title"
          defaultValue={topic.title}
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "topic-edit-error" : undefined}
          className="field"
        />
      </label>
      <label className="field-label">
        Resumen
        <input name="summary" defaultValue={topic.summary} className="field" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Guardando…" : "Guardar subtema"}
        </button>
        {state.error && <p id="topic-edit-error" className="form-error" role="alert">{state.error}</p>}
        {state.ok && <p className="form-ok" role="status">Subtema guardado.</p>}
      </div>
    </form>
  );
}
