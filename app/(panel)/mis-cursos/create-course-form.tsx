"use client";

import { useActionState } from "react";

import { createCourse, type ActionResult } from "@/lib/actions/content";

export function CreateCourseForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createCourse, {});

  return (
    <form
      action={action}
      className="flex flex-wrap items-start gap-3 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <input
        name="title"
        required
        placeholder="Título del curso nuevo"
        className="min-w-60 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear curso"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
