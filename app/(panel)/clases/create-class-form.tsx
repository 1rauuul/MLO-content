"use client";

import { useActionState } from "react";

import { createClass, type ClassResult } from "@/lib/actions/classes";

export function CreateClassForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<ClassResult, FormData>(createClass, {});

  return (
    <form action={action} className="card flex flex-wrap items-start gap-3 p-4">
      <input
        name="name"
        required
        maxLength={80}
        placeholder="Nombre del grupo (por ejemplo, Grupo A)"
        aria-label="Nombre del grupo"
        className="field min-w-60 flex-1"
      />
      <select name="courseId" required className="field min-w-48" aria-label="Curso padre">
        <option value="">Curso padre…</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </select>
      <input
        name="capacity"
        type="number"
        min={1}
        placeholder="Cupo (opcional)"
        aria-label="Cupo del grupo"
        className="field w-36"
      />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creando…" : "Crear grupo"}
      </button>
      {state.error && (
        <p className="form-error w-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
