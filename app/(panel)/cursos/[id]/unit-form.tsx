"use client";

import { useActionState } from "react";

import { createUnit, type ActionResult } from "@/lib/actions/content";

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function CreateUnitForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createUnit, {});

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-5">
      <input type="hidden" name="courseId" value={courseId} />
      <p className="text-sm font-medium text-zinc-900">Agregar unidad</p>

      <input name="title" required placeholder="Título de la unidad" className={inputClass} />
      <textarea
        name="description"
        rows={2}
        placeholder="Descripción breve"
        className={inputClass}
      />

      <div className="flex flex-wrap gap-3">
        <select name="difficulty" defaultValue="Fundamental" className={inputClass}>
          <option value="Fundamental">Fundamental</option>
          <option value="Intermedio">Intermedio</option>
          <option value="Avanzado">Avanzado</option>
        </select>
        <select name="color" defaultValue="blue" className={inputClass}>
          <option value="blue">Azul</option>
          <option value="violet">Violeta</option>
          <option value="green">Verde</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Agregando…" : "Agregar unidad"}
        </button>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
