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

export function LessonEditor({
  lesson,
  allowMedia,
}: {
  lesson: EditableLesson;
  allowMedia: boolean;
}) {
  const [state, action, pending] = useActionState<LessonResult, FormData>(updateLesson, {});
  const [draft, setDraft] = useState({
    title: lesson.title,
    content: lesson.content,
  });

  const onBlocks = useCallback((content: ContentBlock[]) => {
    setDraft((current) => (current.content === content ? current : { ...current, content }));
  }, []);

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
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
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
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Bloques de contenido</h2>
          <BlockEditor initial={lesson.content} allowMedia={allowMedia} onChange={onBlocks} />
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
            eyebrow={lesson.eyebrow}
            body={lesson.body}
            codeSample={lesson.codeSample}
            contextTitle={lesson.contextTitle}
            contextBody={lesson.contextBody}
            synthesis={lesson.synthesis}
            blocks={draft.content}
            errors={errors}
          />
        </PreviewFrame>
      </aside>
    </div>
  );
}
