"use client";

import { useActionState } from "react";

import { updateLesson, type LessonResult } from "@/lib/actions/content";
import type { ContentBlock } from "@/lib/content";

import { BlockEditor } from "./block-editor";

const fieldClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

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
    <form action={action} className="space-y-6">
      <input type="hidden" name="lessonId" value={lesson.id} />

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Título
          <input name="title" required defaultValue={lesson.title} className={fieldClass} />
        </label>

        <div className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Código
          <p className="rounded-lg bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-600">
            {lesson.code}
          </p>
          <span className="text-xs text-zinc-400">
            No cambia: los ids publicados dependen de él.
          </span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700 sm:col-span-2">
          Subtítulo (eyebrow)
          <input name="eyebrow" defaultValue={lesson.eyebrow} className={fieldClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700 sm:col-span-2">
          Resumen
          <textarea name="body" rows={3} defaultValue={lesson.body} className={fieldClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Título del contexto
          <input name="contextTitle" defaultValue={lesson.contextTitle} className={fieldClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700 sm:row-span-2">
          Texto del contexto
          <textarea
            name="contextBody"
            rows={4}
            defaultValue={lesson.contextBody}
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700 sm:col-span-2">
          Ejemplo de código (opcional)
          <textarea
            name="codeSample"
            rows={4}
            defaultValue={lesson.codeSample}
            className={`${fieldClass} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700 sm:col-span-2">
          Síntesis (una idea por línea)
          <textarea
            name="synthesis"
            rows={4}
            defaultValue={lesson.synthesis.join("\n")}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <BlockEditor initial={lesson.content} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700">Cambios guardados.</p>}
      </div>
    </form>
  );
}
