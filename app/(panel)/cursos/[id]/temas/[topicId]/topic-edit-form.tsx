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
      <label className="space-y-1 text-sm">
        <span className="eyebrow">Título</span>
        <input name="title" defaultValue={topic.title} required className="field" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="eyebrow">Resumen</span>
        <input name="summary" defaultValue={topic.summary} className="field" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Guardando…" : "Guardar subtema"}
        </button>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.ok && <p className="form-ok" role="status">Subtema guardado.</p>}
      </div>
    </form>
  );
}
