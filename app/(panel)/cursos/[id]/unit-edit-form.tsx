"use client";

import { useActionState } from "react";

import { updateUnit, type ActionResult } from "@/lib/actions/content";

export function UnitEditForm({
  courseId,
  unit,
}: {
  courseId: string;
  unit: { id: string; title: string; description: string };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateUnit, {});

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="unitId" value={unit.id} />
      <label className="field-label">
        Título de la unidad
        <input
          name="title"
          defaultValue={unit.title}
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "unit-edit-error" : undefined}
          className="field"
        />
      </label>
      <label className="field-label">
        Descripción
        <textarea
          name="description"
          defaultValue={unit.description}
          rows={2}
          className="field"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Guardando…" : "Guardar unidad"}
        </button>
        {state.error && (
          <p id="unit-edit-error" className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="form-ok" role="status">
            Unidad guardada.
          </p>
        )}
      </div>
    </form>
  );
}
