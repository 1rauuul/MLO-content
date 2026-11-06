"use client";

import { useActionState } from "react";

import { updateEvaluation, type TopicResult } from "@/lib/actions/topics";

export function EvaluationEditForm({
  courseId,
  topicId,
  evaluation,
  lessons,
  exercises,
  selected,
}: {
  courseId: string;
  topicId: string;
  evaluation: { id: string; title: string; description: string; lessonId: string };
  lessons: { id: string; code: string; title: string }[];
  exercises: { content_id: string; type: string; title: string }[];
  selected: string[];
}) {
  const [state, action, pending] = useActionState<TopicResult, FormData>(
    updateEvaluation,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="evaluationId" value={evaluation.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="eyebrow">Título</span>
          <input name="title" defaultValue={evaluation.title} required className="field" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="eyebrow">Lección de anclaje v2</span>
          <select name="lessonId" defaultValue={evaluation.lessonId} className="field">
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.code} · {lesson.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="eyebrow">Descripción</span>
          <input name="description" defaultValue={evaluation.description} className="field" />
        </label>
      </div>

      <fieldset className="space-y-2 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink-soft">
          Ejercicios de esta evaluación
        </legend>
        <p className="text-xs text-ink-muted">
          Puedes no marcar ninguno: la evaluación será solo de preguntas.
        </p>
        {exercises.length === 0 ? (
          <p className="text-sm text-ink-muted">El subtema todavía no tiene ejercicios.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {exercises.map((exercise) => (
              <label key={exercise.content_id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="exerciseIds"
                  value={exercise.content_id}
                  defaultChecked={selected.includes(exercise.content_id)}
                  className="size-4"
                />
                <span className="badge badge-neutral">{exercise.type}</span>
                {exercise.title}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Guardando…" : "Guardar evaluación"}
        </button>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.ok && <p className="form-ok" role="status">Evaluación guardada.</p>}
      </div>
    </form>
  );
}
