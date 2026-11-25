"use client";

import { useActionState } from "react";

import { createLesson, type ActionResult } from "@/lib/actions/content";

import { BlockEditor } from "./lecciones/[lessonId]/block-editor";
import { RequiredMark } from "@/app/(panel)/required-mark";

const inputClass = "field";

export function CreateLessonForm({
  courseId,
  topicId,
  allowMedia,
}: {
  courseId: string;
  topicId: string;
  allowMedia: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createLesson, {});

  return (
    <form action={action} className="mt-4 max-w-3xl space-y-3 border-t border-line pt-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <label className="field-label">
        <span>Título de la lección <RequiredMark /></span>
        <input
          name="title"
          required
          placeholder="Título de la lección"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "lesson-form-error" : undefined}
          className={`${inputClass} max-w-xl`}
        />
      </label>
      <BlockEditor initial={[]} allowMedia={allowMedia} />
      <button type="submit" disabled={pending} className="btn btn-secondary">
        {pending ? "Agregando…" : "Agregar lección"}
      </button>
      {state.error && (
        <p id="lesson-form-error" className="form-error w-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
