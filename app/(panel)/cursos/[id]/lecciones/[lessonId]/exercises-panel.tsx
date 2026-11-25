"use client";

import { useCallback, useState } from "react";

import { ConfirmDialog } from "@/app/(panel)/confirm-dialog";
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
  const [deleting, setDeleting] = useState<CoreExercise | null>(null);
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

              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                  Vista previa
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
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
                  <button
                    type="button"
                    onClick={() => setDeleting(exercise)}
                    className="btn btn-danger btn-sm"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="Eliminar ejercicio"
          description="Esta acción no cambia el release ya publicado."
          action={deleteExercise}
          hiddenFields={{ lessonId, exerciseId: deleting.content_id }}
          confirmLabel="Eliminar ejercicio"
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
