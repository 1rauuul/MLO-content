"use client";

import { useActionState, useCallback, useState } from "react";

import { updateLesson, type LessonResult } from "@/lib/actions/content";
import type { ContentBlock } from "@/lib/content";
import { previewBlockErrors } from "@/lib/content/preview";
import { PreviewFrame } from "@/app/(panel)/preview-frame";

import { BlockEditor } from "./block-editor";
import { LessonReadingPreview } from "./preview";

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
  const [draft, setDraft] = useState({
    title: lesson.title,
    eyebrow: lesson.eyebrow,
    body: lesson.body,
    codeSample: lesson.codeSample,
    contextTitle: lesson.contextTitle,
    contextBody: lesson.contextBody,
    synthesisText: lesson.synthesis.join("\n"),
    content: lesson.content,
  });

  const patch = (values: Partial<typeof draft>) =>
    setDraft((current) => ({ ...current, ...values }));

  const onBlocks = useCallback((content: ContentBlock[]) => {
    setDraft((current) => (current.content === content ? current : { ...current, content }));
  }, []);

  const synthesis = draft.synthesisText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const errors = [
    ...(draft.title.trim() ? [] : ["El título es obligatorio."]),
    ...previewBlockErrors(draft.content),
  ];

  return (
    <div className="editor-preview-grid">
      <form action={action} className="space-y-5">
        <input type="hidden" name="lessonId" value={lesson.id} />

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Datos de la lección</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Título
              <input
                name="title"
                required
                value={draft.title}
                onChange={(event) => patch({ title: event.target.value })}
                className={fieldClass}
              />
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
              <input
                name="eyebrow"
                value={draft.eyebrow}
                onChange={(event) => patch({ eyebrow: event.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="field-label sm:col-span-2">
              Resumen
              <textarea
                name="body"
                rows={3}
                value={draft.body}
                onChange={(event) => patch({ body: event.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="field-label">
              Título del contexto
              <input
                name="contextTitle"
                value={draft.contextTitle}
                onChange={(event) => patch({ contextTitle: event.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="field-label sm:row-span-2">
              Texto del contexto
              <textarea
                name="contextBody"
                rows={4}
                value={draft.contextBody}
                onChange={(event) => patch({ contextBody: event.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="field-label sm:col-span-2">
              Ejemplo de código (opcional)
              <textarea
                name="codeSample"
                rows={4}
                value={draft.codeSample}
                onChange={(event) => patch({ codeSample: event.target.value })}
                className={`${fieldClass} font-mono`}
              />
            </label>

            <label className="field-label sm:col-span-2">
              Síntesis (una idea por línea)
              <textarea
                name="synthesis"
                rows={4}
                value={draft.synthesisText}
                onChange={(event) => patch({ synthesisText: event.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Bloques de contenido</h2>
          <BlockEditor initial={lesson.content} onChange={onBlocks} />
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

      <aside className="editor-preview-aside">
        <PreviewFrame label="MLO · Lección">
          <LessonReadingPreview
            title={draft.title}
            eyebrow={draft.eyebrow}
            body={draft.body}
            codeSample={draft.codeSample}
            contextTitle={draft.contextTitle}
            contextBody={draft.contextBody}
            synthesis={synthesis}
            blocks={draft.content}
            errors={errors}
          />
        </PreviewFrame>
      </aside>
    </div>
  );
}
