"use client";

import { useActionState } from "react";

import { createUnit, type ActionResult } from "@/lib/actions/content";

const inputClass = "field";

export function CreateUnitForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createUnit, {});

  return (
    <form action={action} className="card grid gap-3 p-5">
      <input type="hidden" name="courseId" value={courseId} />
      <p className="text-sm font-semibold text-ink">Agregar unidad</p>

      <input
        name="title"
        required
        placeholder="Título de la unidad"
        aria-label="Título de la unidad"
        className={inputClass}
      />
      <textarea
        name="description"
        rows={2}
        placeholder="Descripción breve"
        aria-label="Descripción breve"
        className={inputClass}
      />

      <div className="flex flex-wrap items-center gap-3">
        <select name="difficulty" defaultValue="Fundamental" className={`${inputClass} w-auto`}>
          <option value="Fundamental">Fundamental</option>
          <option value="Intermedio">Intermedio</option>
          <option value="Avanzado">Avanzado</option>
        </select>
        <select name="color" defaultValue="blue" className={`${inputClass} w-auto`}>
          <option value="blue">Azul</option>
          <option value="violet">Violeta</option>
          <option value="green">Verde</option>
        </select>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Agregando…" : "Agregar unidad"}
        </button>
      </div>

      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
