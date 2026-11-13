"use client";

import { useActionState, useState } from "react";

import { updateEvaluation, type TopicResult } from "@/lib/actions/topics";
import { evaluationComposition } from "@/lib/content/preview";
import { PreviewFrame } from "@/app/(panel)/preview-frame";

export function EvaluationEditForm({
  courseId,
  topicId,
  evaluation,
  exercises,
  selected,
  questionCount,
}: {
  courseId: string;
  topicId: string;
  evaluation: { id: string; title: string; description: string };
  exercises: { content_id: string; type: string; title: string }[];
  selected: string[];
  questionCount: number;
}) {
  const [state, action, pending] = useActionState<TopicResult, FormData>(
    updateEvaluation,
    {},
  );
  const [title, setTitle] = useState(evaluation.title);
  const [description, setDescription] = useState(evaluation.description);
  const [exerciseIds, setExerciseIds] = useState(selected);
  const composition = evaluationComposition(exerciseIds);

  function toggle(contentId: string, checked: boolean) {
    setExerciseIds((current) =>
      checked ? [...new Set([...current, contentId])] : current.filter((id) => id !== contentId),
    );
  }

  return (
    <div className="editor-preview-grid">
      <form action={action} className="space-y-4">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="topicId" value={topicId} />
        <input type="hidden" name="evaluationId" value={evaluation.id} />

        <div className="grid gap-3">
          <label className="field-label">
            Título
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              aria-invalid={title.trim() === "" || Boolean(state.error)}
              aria-describedby={
                state.error
                  ? "evaluation-edit-error"
                  : title.trim() === ""
                    ? "evaluation-title-error"
                    : undefined
              }
              className="field"
            />
          </label>
          <label className="field-label">
            Descripción
            <input
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field"
            />
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
                    checked={exerciseIds.includes(exercise.content_id)}
                    onChange={(event) => toggle(exercise.content_id, event.target.checked)}
                    className="size-4"
                  />
                  <span className="badge badge-neutral">{exercise.type}</span>
                  {exercise.title}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {title.trim() === "" && (
          <p id="evaluation-title-error" className="form-error" role="status">
            El título es obligatorio para guardar y publicar la evaluación.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending ? "Guardando…" : "Guardar evaluación"}
          </button>
          {state.error && <p id="evaluation-edit-error" className="form-error" role="alert">{state.error}</p>}
          {state.ok && <p className="form-ok" role="status">Evaluación guardada.</p>}
        </div>
      </form>

      <aside className="editor-preview-aside">
        <PreviewFrame label="MLO · Evaluación">
          <article className="space-y-3">
            <p className="preview-eyebrow">Evaluación</p>
            <h1 className="preview-title">{title || "Título de la evaluación"}</h1>
            {description && <p className="preview-body">{description}</p>}
            <p className="preview-composition">{composition.label}</p>
            {exerciseIds.length === 0 ? (
              <p className="preview-empty">
                Solo preguntas: no se incluirán ejercicios en esta evaluación.
              </p>
            ) : (
              <ul className="preview-prose">
                {exercises
                  .filter((exercise) => exerciseIds.includes(exercise.content_id))
                  .map((exercise) => (
                    <li key={exercise.content_id}>{exercise.title}</li>
                  ))}
              </ul>
            )}
            <p className="preview-note">
              {questionCount === 1
                ? "1 pregunta publicada"
                : `${questionCount} preguntas publicadas`}
            </p>
          </article>
        </PreviewFrame>
      </aside>
    </div>
  );
}
