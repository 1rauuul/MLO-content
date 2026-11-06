"use client";

import { useActionState } from "react";

import { createEvaluation, type TopicResult } from "@/lib/actions/topics";

export function CreateEvaluationForm({
  courseId,
  topicId,
  lessons,
}: {
  courseId: string;
  topicId: string;
  lessons: { id: string; title: string; code: string }[];
}) {
  const [state, action, pending] = useActionState<TopicResult, FormData>(
    createEvaluation,
    {},
  );

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-line pt-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="eyebrow">Título</span>
          <input name="title" required className="field" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="eyebrow">Lección de anclaje v2</span>
          <select name="lessonId" required className="field">
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.code} · {lesson.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="eyebrow">Descripción</span>
          <input name="description" className="field" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || lessons.length === 0} className="btn btn-secondary btn-sm">
          {pending ? "Creando…" : "Crear evaluación"}
        </button>
        {lessons.length === 0 && <p className="text-xs text-ink-faint">Crea una lección primero.</p>}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}
