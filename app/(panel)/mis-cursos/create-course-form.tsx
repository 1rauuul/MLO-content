"use client";

import { useActionState } from "react";

import { createCourse, type ActionResult } from "@/lib/actions/content";

export function CreateCourseForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createCourse, {});

  return (
    <form action={action} className="card flex flex-wrap items-start gap-3 p-4">
      <input
        name="title"
        required
        placeholder="Título del curso nuevo"
        aria-label="Título del curso nuevo"
        className="field min-w-60 flex-1"
      />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creando…" : "Crear curso"}
      </button>
      {state.error && (
        <p className="form-error w-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
