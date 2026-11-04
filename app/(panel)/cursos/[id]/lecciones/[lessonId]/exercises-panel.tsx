"use client";

import { useCallback, useState } from "react";

import type { CoreExercise } from "@/lib/content/model";
import { deleteExercise } from "@/lib/actions/exercises";

import { ExerciseForm } from "./exercise-form";
import { ExercisePreview } from "./preview";

const TYPE_LABEL = {
  order: "Ordenar",
  fill: "Completar",
  match: "Relacionar",
  crossword: "Crucigrama",
} as const;

export function ExercisesPanel({
  lessonId,
  exercises,
  readOnly,
}: {
  lessonId: string;
  exercises: CoreExercise[];
  readOnly: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = exercises.find((exercise) => exercise.content_id === editingId) ?? null;

  const close = useCallback(() => {
    setCreating(false);
    setEditingId(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Ejercicios</h2>
          <p className="text-sm text-ink-muted">
            {exercises.length} {exercises.length === 1 ? "ejercicio" : "ejercicios"}.
            Puedes marcarlos también como ejemplo.
          </p>
        </div>
        {!readOnly && !creating && !editing && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn btn-primary btn-sm"
          >
            Agregar ejercicio
          </button>
        )}
      </div>

      {(creating || editing) && (
        <ExerciseForm
          key={editing?.content_id ?? "new"}
          lessonId={lessonId}
          initial={editing ?? undefined}
          onSaved={close}
          onCancel={close}
        />
      )}

      {exercises.length === 0 ? (
        <p className="empty">
          Esta lección todavía no tiene ejercicios.
        </p>
      ) : (
        <ul className="space-y-3">
          {exercises.map((exercise) => (
            <li key={exercise.content_id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-neutral">
                  {TYPE_LABEL[exercise.type]}
                </span>
                <span className="font-medium text-ink">{exercise.prompt}</span>
                {exercise.example && (
                  <span className="badge badge-warning">
                    También ejemplo
                  </span>
                )}
                <span className="ml-auto font-mono text-xs text-ink-faint">
                  {exercise.content_id}
                </span>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-ink-muted">Vista previa</summary>
                <div className="mt-3">
                  <ExercisePreview
                    type={exercise.type}
                    prompt={exercise.prompt}
                    instructions={exercise.instructions}
                    correctOrder={exercise.correct_order}
                    config={exercise.config}
                    explanation={exercise.explanation}
                    example={exercise.example}
                  />
                </div>
              </details>

              {!readOnly && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(exercise.content_id);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Editar
                  </button>
                  <form
                    action={deleteExercise}
                    onSubmit={(event) => {
                      if (!confirm("¿Eliminar este ejercicio? El release publicado no cambia.")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="lessonId" value={lessonId} />
                    <input type="hidden" name="exerciseId" value={exercise.content_id} />
                    <button
                      type="submit"
                      className="btn btn-danger btn-sm"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
