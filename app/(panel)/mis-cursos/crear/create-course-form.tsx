"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { PreviewFrame } from "@/app/(panel)/preview-frame";
import { createCourse, type ActionResult } from "@/lib/actions/content";

const LEVELS = ["Fundamental", "Intermedio", "Avanzado"] as const;

export function CreateCourseForm({
  baseCourseId,
}: {
  baseCourseId: string | null;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createCourse, {});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<string>(LEVELS[0]);
  const [usesBase, setUsesBase] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href="/mis-cursos"
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            ← Mis cursos
          </Link>
          <h1 className="page-title mt-1">Crea un curso desde cero</h1>
          <p className="page-lead">
            Define el curso que tus alumnos descargarán desde MLO. Puedes empezar vacío
            o cargar el contenido base como punto de partida.
          </p>
        </div>
        <button
          type="submit"
          form="create-course"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Creando…" : "Crear curso"}
        </button>
      </header>

      <div className="editor-preview-grid">
        <form id="create-course" action={action} className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Datos del curso</h2>
            <span className="eyebrow">Nuevo curso</span>
          </div>

          <div className="space-y-5 p-5">
            <label className="field-label">
              Nombre del curso
              <input
                name="title"
                required
                minLength={3}
                maxLength={80}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Diseño de experiencias de usuario"
                className="field"
                autoFocus
              />
            </label>

            <label className="field-label">
              Descripción
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Qué aprenderán los alumnos en este curso."
                className="field"
              />
              <span className="hint">Aparece en la biblioteca del alumno.</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Clave del catálogo
                <input
                  value="Se genera al crear"
                  disabled
                  className="field disabled:bg-surface-soft disabled:text-ink-muted"
                />
                <span className="hint">Se asigna automáticamente al crear el curso.</span>
              </label>

              <label className="field-label">
                Nivel
                <select
                  name="level"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  className="field"
                >
                  {LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex gap-3 rounded-xl border border-line bg-surface-soft p-4">
              <input
                type="checkbox"
                name="usesBase"
                checked={usesBase}
                onChange={(event) => setUsesBase(event.target.checked)}
                className="mt-0.5 size-4 accent-brand"
              />
              <span className="text-sm">
                <span className="block font-medium text-ink">Cargar contenido base</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                  Incluye el contenido base compartido como punto de partida. Si queda
                  desactivado, el curso inicia totalmente vacío.
                </span>
              </span>
            </label>

            {baseCourseId && (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface-soft/60 p-4 text-sm text-ink-muted">
                ¿Ya existe el curso?{" "}
                <Link href={`/cursos/${baseCourseId}`} className="link">
                  Abrir el contenido base
                </Link>{" "}
                y revisa cómo está estructurado.
              </div>
            )}

            {state.error && (
              <p className="form-error" role="alert">
                {state.error}
              </p>
            )}
          </div>
        </form>

        <aside className="editor-preview-aside space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Vista previa · MLO</h2>
            <span className="text-xs text-ink-faint">En vivo</span>
          </div>

          <PreviewFrame label="Biblioteca del alumno">
            <div>
              <p className="preview-eyebrow">Tu biblioteca</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Mis cursos
              </h3>

              {title.trim() ? (
                <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-neutral">{level}</span>
                    {usesBase && (
                      <span className="badge badge-neutral">Contenido base</span>
                    )}
                  </div>
                  <p className="mt-2 text-lg font-semibold leading-snug text-ink">
                    {title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {description.trim() || "Preparando ruta de aprendizaje."}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
                  <p className="text-sm font-semibold text-ink">Aún no hay cursos</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    Cuando tu maestro publique y comparta un grupo, aquí aparecerán los
                    cursos disponibles.
                  </p>
                </div>
              )}
            </div>
          </PreviewFrame>
        </aside>
      </div>
    </div>
  );
}
