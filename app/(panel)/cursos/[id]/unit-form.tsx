"use client";

import { useActionState, useState } from "react";

import { createUnit, type ActionResult } from "@/lib/actions/content";

const inputClass = "field";
const COLOR_OPTIONS = [
  { value: "blue", label: "Azul", swatch: "bg-blue-500" },
  { value: "violet", label: "Violeta", swatch: "bg-violet-500" },
  { value: "green", label: "Verde", swatch: "bg-emerald-500" },
  { value: "amber", label: "Ámbar", swatch: "bg-amber-500" },
  { value: "orange", label: "Naranja", swatch: "bg-orange-500" },
  { value: "rose", label: "Rosa", swatch: "bg-rose-500" },
  { value: "teal", label: "Turquesa", swatch: "bg-teal-500" },
] as const;

export function CreateUnitForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createUnit, {});
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<(typeof COLOR_OPTIONS)[number]["value"]>("blue");
  const selectedColor =
    COLOR_OPTIONS.find((option) => option.value === color) ?? COLOR_OPTIONS[0];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Crear unidad</h2>
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
        <form action={action} className="grid max-w-xl gap-3 border-t border-line p-5">
          <input type="hidden" name="courseId" value={courseId} />

          <label className="field-label">
            Título de la unidad
            <input
              name="title"
              required
              placeholder="Ej. Fundamentos"
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? "unit-form-error" : undefined}
              className={inputClass}
            />
          </label>
          <label className="field-label">
            Descripción breve
            <textarea name="description" rows={2} placeholder="Opcional" className={inputClass} />
          </label>

          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
            <label className="field-label">
              Nivel
              <select name="difficulty" defaultValue="Fundamental" className={inputClass}>
              <option value="Fundamental">Fundamental</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
              </select>
            </label>
            <label className="field-label">
              <span className="flex items-center gap-2">
                Color de identificación
                <span
                  className={`size-3 rounded-full ${selectedColor.swatch}`}
                  aria-hidden="true"
                />
              </span>
              <select
                name="color"
                value={color}
                onChange={(event) =>
                  setColor(event.target.value as (typeof COLOR_OPTIONS)[number]["value"])
                }
                className={inputClass}
              >
                {COLOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" disabled={pending} className="btn btn-primary justify-self-start">
            {pending ? "Agregando…" : "Crear unidad"}
          </button>

          {state.error && (
            <p id="unit-form-error" className="form-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
