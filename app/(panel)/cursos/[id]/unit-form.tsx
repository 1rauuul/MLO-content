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
            <input name="title" required placeholder="Ej. Fundamentos" className={inputClass} />
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
            <div>
              <p className="field-label">Color de identificación</p>
              <input type="hidden" name="color" value={color} />
              <div className="mt-1 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Color de identificación">
                {COLOR_OPTIONS.map((option) => {
                  const selected = color === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setColor(option.value)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition ${
                        selected
                          ? "border-ink bg-surface-soft text-ink ring-1 ring-ink"
                          : "border-line bg-white text-ink-muted hover:border-ink-soft"
                      }`}
                    >
                      <span className={`size-3 rounded-full ${option.swatch}`} aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button type="submit" disabled={pending} className="btn btn-primary justify-self-start">
            {pending ? "Agregando…" : "Crear unidad"}
          </button>

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
