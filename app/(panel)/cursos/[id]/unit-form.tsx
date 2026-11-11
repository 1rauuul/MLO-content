"use client";

import { useActionState, useState } from "react";

import { createUnit, type ActionResult } from "@/lib/actions/content";

const inputClass = "field";

export function CreateUnitForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createUnit, {});
  const [open, setOpen] = useState(false);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Unidades</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Organiza los subtemas del curso.</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="btn btn-primary btn-sm"
        >
          {open ? "Cerrar" : "Agregar unidad"}
        </button>
      </div>

      {open && (
        <form action={action} className="grid gap-3 border-t border-line p-5">
          <input type="hidden" name="courseId" value={courseId} />
          <p className="text-sm font-semibold text-ink">Nueva unidad</p>

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
              {pending ? "Agregando…" : "Crear unidad"}
            </button>
          </div>

          {state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
