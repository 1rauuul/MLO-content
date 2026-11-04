"use client";

import { useActionState } from "react";

import { updateLesson, type LessonResult } from "@/lib/actions/content";
import type { ContentBlock } from "@/lib/content";

import { BlockEditor } from "./block-editor";

const fieldClass = "field";

export type EditableLesson = {
  id: string;
  code: string;
  title: string;
  eyebrow: string;
  body: string;
  codeSample: string;
  contextTitle: string;
  contextBody: string;
  synthesis: string[];
  content: ContentBlock[];
};

export function LessonEditor({ lesson }: { lesson: EditableLesson }) {
  const [state, action, pending] = useActionState<LessonResult, FormData>(updateLesson, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="lessonId" value={lesson.id} />

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Datos de la lección</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Título
            <input name="title" required defaultValue={lesson.title} className={fieldClass} />
          </label>

          <div className="field-label">
            Código
            <p className="rounded-[var(--radius-control)] bg-surface-soft px-3 py-2 font-mono text-sm text-ink-soft ring-1 ring-line">
              {lesson.code}
            </p>
            <span className="hint">No cambia: los ids publicados dependen de él.</span>
          </div>

          <label className="field-label sm:col-span-2">
            Subtítulo (eyebrow)
            <input name="eyebrow" defaultValue={lesson.eyebrow} className={fieldClass} />
          </label>

          <label className="field-label sm:col-span-2">
            Resumen
            <textarea name="body" rows={3} defaultValue={lesson.body} className={fieldClass} />
          </label>

          <label className="field-label">
            Título del contexto
            <input
              name="contextTitle"
              defaultValue={lesson.contextTitle}
              className={fieldClass}
            />
          </label>

          <label className="field-label sm:row-span-2">
            Texto del contexto
            <textarea
              name="contextBody"
              rows={4}
              defaultValue={lesson.contextBody}
              className={fieldClass}
            />
          </label>

          <label className="field-label sm:col-span-2">
            Ejemplo de código (opcional)
            <textarea
              name="codeSample"
              rows={4}
              defaultValue={lesson.codeSample}
              className={`${fieldClass} font-mono`}
            />
          </label>

          <label className="field-label sm:col-span-2">
            Síntesis (una idea por línea)
            <textarea
              name="synthesis"
              rows={4}
              defaultValue={lesson.synthesis.join("\n")}
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Bloques de contenido</h2>
        <BlockEditor initial={lesson.content} />
      </section>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="form-ok" role="status">
            Cambios guardados.
          </p>
        )}
      </div>
    </form>
  );
}
