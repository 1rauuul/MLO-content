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
          <h2 className="font-medium text-zinc-900">Ejercicios</h2>
          <p className="text-sm text-zinc-500">
            {exercises.length} {exercises.length === 1 ? "ejercicio" : "ejercicios"}.
            Puedes marcarlos también como ejemplo.
          </p>
        </div>
        {!readOnly && !creating && !editing && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
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
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          Esta lección todavía no tiene ejercicios.
        </p>
      ) : (
        <ul className="space-y-3">
          {exercises.map((exercise) => (
            <li key={exercise.content_id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {TYPE_LABEL[exercise.type]}
                </span>
                <span className="font-medium text-zinc-900">{exercise.prompt}</span>
                {exercise.example && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    También ejemplo
                  </span>
                )}
                <span className="ml-auto font-mono text-xs text-zinc-400">
                  {exercise.content_id}
                </span>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-500">Vista previa</summary>
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
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
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
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:border-red-400"
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
