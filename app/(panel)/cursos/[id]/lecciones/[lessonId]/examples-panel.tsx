"use client";

import { useCallback, useState } from "react";

import { ConfirmDialog } from "@/app/(panel)/confirm-dialog";
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
  const [deleting, setDeleting] = useState<CoreExample | null>(null);
  const editing = examples.find((example) => example.content_id === editingId) ?? null;

  const close = useCallback(() => {
    setCreating(false);
    setEditingId(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Ejemplos independientes</h2>
          <p className="text-sm text-ink-muted">
            {examples.length} {examples.length === 1 ? "ejemplo" : "ejemplos"}. No están
            ligados a un ejercicio.
          </p>
        </div>
        {!readOnly && !creating && !editing && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn btn-primary btn-sm"
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
        <p className="empty">
          Esta lección todavía no tiene ejemplos independientes.
        </p>
      ) : (
        <ul className="space-y-3">
          {examples.map((example) => (
            <li key={example.content_id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-neutral">
                  {TYPE_LABEL[example.type]}
                </span>
                <span className="font-medium text-ink">{example.title}</span>
                <span className="ml-auto font-mono text-xs text-ink-faint">
                  {example.content_id}
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
                    className="btn btn-secondary btn-sm"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(example)}
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
          title="Eliminar ejemplo"
          description="Esta acción no cambia el release ya publicado."
          action={deleteExample}
          hiddenFields={{ lessonId, exampleId: deleting.content_id }}
          confirmLabel="Eliminar ejemplo"
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
