"use client";

import { useActionState } from "react";

import { createLesson, type ActionResult } from "@/lib/actions/content";

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function CreateLessonForm({
  courseId,
  unitId,
}: {
  courseId: string;
  unitId: string;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createLesson, {});

  return (
    <form
      action={action}
      className="mt-4 flex flex-wrap items-start gap-2 border-t border-zinc-100 pt-4"
    >
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="unitId" value={unitId} />
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
        className={`${inputClass} min-w-52 flex-1`}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Agregando…" : "Agregar lección"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
