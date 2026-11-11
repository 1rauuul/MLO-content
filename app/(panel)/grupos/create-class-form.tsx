"use client";

import { useActionState } from "react";

import { createClass, type ClassResult } from "@/lib/actions/classes";

type CourseOption = { id: string; title: string };

export function CreateClassForm({ courses }: { courses: CourseOption[] }) {
  const [state, action, pending] = useActionState<ClassResult, FormData>(createClass, {});

  return (
    <form action={action} className="card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Nuevo grupo</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          El código de acceso se genera automáticamente.
        </p>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="field-label">
          Nombre del grupo
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Ej. UX · Grupo A"
            className="field"
          />
        </label>

        <label className="field-label">
          Curso asignado
          <select name="courseId" required defaultValue="" className="field">
            <option value="" disabled>
              Selecciona un curso
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
          <span className="hint">El grupo usará este curso; podrás crearle contenido propio después.</span>
        </label>

        <button
          type="submit"
          disabled={pending || courses.length === 0}
          className="btn btn-primary w-full sm:w-auto"
        >
          {pending ? "Creando…" : "Crear grupo"}
        </button>
      </div>

      {courses.length === 0 && (
        <p className="px-5 pb-5 text-sm text-ink-muted">
          Primero crea un curso para poder asignarlo a un grupo.
        </p>
      )}

      {state.error && (
        <p className="form-error px-5 pb-5" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
