"use client";

import { useCallback, useState } from "react";

import type { CoreExample } from "@/lib/content/model";
import { deleteExample } from "@/lib/actions/exercises";

import { ExampleForm } from "./example-form";
import { ExamplePreview } from "./preview";

const TYPE_LABEL = {
  order: "Ordenar",
  fill: "Completar",
  match: "Relacionar",
  crossword: "Crucigrama",
} as const;

export function ExamplesPanel({
  lessonId,
  examples,
  readOnly,
}: {
  lessonId: string;
  examples: CoreExample[];
  readOnly: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = examples.find((example) => example.content_id === editingId) ?? null;

  const close = useCallback(() => {
    setCreating(false);
    setEditingId(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-zinc-900">Ejemplos independientes</h2>
          <p className="text-sm text-zinc-500">
            {examples.length} {examples.length === 1 ? "ejemplo" : "ejemplos"}. No están
            ligados a un ejercicio.
          </p>
        </div>
        {!readOnly && !creating && !editing && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Agregar ejemplo
          </button>
        )}
      </div>

      {(creating || editing) && (
        <ExampleForm
          key={editing?.content_id ?? "new"}
          lessonId={lessonId}
          initial={editing ?? undefined}
          onSaved={close}
          onCancel={close}
        />
      )}

      {examples.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          Esta lección todavía no tiene ejemplos independientes.
        </p>
      ) : (
        <ul className="space-y-3">
          {examples.map((example) => (
            <li key={example.content_id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {TYPE_LABEL[example.type]}
                </span>
                <span className="font-medium text-zinc-900">{example.title}</span>
                <span className="ml-auto font-mono text-xs text-zinc-400">
                  {example.content_id}
                </span>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-500">Vista previa</summary>
                <div className="mt-3">
                  <ExamplePreview
                    type={example.type}
                    title={example.title}
                    prompt={example.prompt}
                    config={example.config}
                    steps={example.steps}
                    hints={example.hints}
                    explanation={example.explanation}
                  />
                </div>
              </details>

              {!readOnly && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(example.content_id);
                    }}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
                  >
                    Editar
                  </button>
                  <form
                    action={deleteExample}
                    onSubmit={(event) => {
                      if (!confirm("¿Eliminar este ejemplo? El release publicado no cambia.")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="lessonId" value={lessonId} />
                    <input type="hidden" name="exampleId" value={example.content_id} />
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
