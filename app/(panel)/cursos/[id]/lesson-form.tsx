"use client";

import { useActionState } from "react";

import { createLesson, type ActionResult } from "@/lib/actions/content";

const inputClass = "field";

export function CreateLessonForm({
  courseId,
  topicId,
}: {
  courseId: string;
  topicId: string;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createLesson, {});

  return (
    <form action={action} className="mt-4 flex flex-wrap items-start gap-2 border-t border-line pt-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <input
        name="code"
        required
        placeholder="1.5"
        className={`${inputClass} w-20`}
        aria-label="Código de la lección"
      />
      <input
        name="title"
        required
        placeholder="Título de la lección"
        aria-label="Título de la lección"
        className={`${inputClass} min-w-52 flex-1`}
      />
      <button type="submit" disabled={pending} className="btn btn-secondary">
        {pending ? "Agregando…" : "Agregar lección"}
      </button>
      {state.error && (
        <p className="form-error w-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
