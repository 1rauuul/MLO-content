"use client";

import { useActionState, useState } from "react";

import { BackLink } from "@/app/(panel)/back-link";
import { CourseIcon } from "@/app/(panel)/course-icon";
import { PreviewFrame } from "@/app/(panel)/preview-frame";
import { createCourse, type ActionResult } from "@/lib/actions/content";
import {
  countWords,
  courseDescriptionError,
  MAX_COURSE_DESCRIPTION_CHARS,
  MAX_COURSE_DESCRIPTION_WORDS,
} from "@/lib/content";
import {
  COURSE_ICON_GROUPS,
  COURSE_ICONS,
  DEFAULT_COURSE_ICON,
  type CourseIconKey,
} from "@/lib/content/course-icons";
import { RequiredMark } from "@/app/(panel)/required-mark";

const LEVELS = ["Fundamental", "Intermedio", "Avanzado"] as const;

export function CreateCourseForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createCourse, {});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<string>(LEVELS[0]);
  const [icon, setIcon] = useState<CourseIconKey>(DEFAULT_COURSE_ICON);
  const [usesBase, setUsesBase] = useState(false);
  const descriptionWords = countWords(description);
  const descriptionError = courseDescriptionError(description);
  const selectedIcon =
    COURSE_ICONS.find((option) => option.key === icon) ?? COURSE_ICONS[0];

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/mis-cursos">Mis cursos</BackLink>
        <h1 className="page-title mt-1">Crea un curso desde cero</h1>
        <p className="page-lead">
          Define el curso que tus alumnos descargarán desde MLO. Se publica
          automáticamente al crearlo; puedes empezar vacío o cargar el contenido base.
        </p>
      </header>

      <div className="editor-preview-grid">
        <form id="create-course" action={action} className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Datos del curso</h2>
          </div>

          <div className="space-y-5 p-5">
            <label className="field-label">
              <span>Nombre del curso <RequiredMark /></span>
              <input
                name="title"
                required
                minLength={3}
                maxLength={80}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Diseño de experiencias de usuario"
                aria-invalid={Boolean(state.error)}
                aria-describedby={state.error ? "course-form-error" : undefined}
                className="field"
                autoFocus
              />
            </label>

            <label className="field-label">
              Descripción breve
              <textarea
                name="description"
                rows={3}
                maxLength={MAX_COURSE_DESCRIPTION_CHARS}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Qué aprenderán los alumnos en este curso."
                aria-invalid={Boolean(state.error) || Boolean(descriptionError)}
                aria-describedby={
                  state.error
                    ? "course-description-count course-form-error"
                    : "course-description-count"
                }
                className="field"
              />
              <span
                id="course-description-count"
                className={`hint ${descriptionError ? "text-danger" : ""}`}
              >
                {descriptionWords}/{MAX_COURSE_DESCRIPTION_WORDS} palabras ·{" "}
                {description.length}/{MAX_COURSE_DESCRIPTION_CHARS} caracteres
                {descriptionError ? ` · ${descriptionError}` : ""}
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Clave del catálogo
                <input
                  value="Se genera al crear"
                  disabled
                  className="field"
                />
                <span className="hint">Se asigna automáticamente al crear el curso.</span>
              </label>

              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-sm text-ink-soft">Nivel</legend>
                <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-line-strong bg-surface-soft p-1">
                  {LEVELS.map((option) => (
                    <label key={option} className="cursor-pointer">
                      <input
                        type="radio"
                        name="level"
                        value={option}
                        checked={level === option}
                        onChange={() => setLevel(option)}
                        className="peer sr-only"
                      />
                      <span className="block rounded-md px-2 py-1.5 text-center text-sm text-ink-muted transition peer-checked:bg-surface peer-checked:font-medium peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <details className="group/icon rounded-xl border border-line bg-surface-soft/40">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-soft">
                  <CourseIcon name={icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">Icono del curso</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {selectedIcon.label} · Se verá en la tarjeta de MLO.
                  </span>
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                  Cambiar
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 transition-transform group-open/icon:rotate-180"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </summary>

              <div className="border-t border-line p-3">
                <fieldset>
                  <legend className="sr-only">Elegir icono del curso</legend>
                  <div className="space-y-3">
                    {COURSE_ICON_GROUPS.map((group) => (
                      <div key={group}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                          {group}
                        </p>
                        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                          {COURSE_ICONS.filter((option) => option.group === group).map(
                            (option) => (
                              <label
                                key={option.key}
                                className="cursor-pointer"
                                title={option.label}
                              >
                                <input
                                  type="radio"
                                  name="icon"
                                  value={option.key}
                                  checked={icon === option.key}
                                  onChange={() => setIcon(option.key)}
                                  aria-label={option.label}
                                  className="peer sr-only"
                                />
                                <span className="flex aspect-square items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-checked:ring-1 peer-checked:ring-accent/30 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                                  <CourseIcon name={option.key} className="size-5" />
                                </span>
                              </label>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>
              </div>
            </details>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-soft p-4">
              <label className="flex max-w-2xl gap-3">
                <input
                  type="checkbox"
                  name="usesBase"
                  checked={usesBase}
                  onChange={(event) => setUsesBase(event.target.checked)}
                  className="mt-0.5 size-4"
                />
                <span className="text-sm">
                  <span className="block font-medium text-ink">
                    Cargar contenido base
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    Incluye el contenido base compartido como punto de partida. Si queda
                    desactivado, el curso inicia totalmente vacío.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary w-full shrink-0 sm:w-auto"
              >
                {pending ? "Creando y publicando…" : "Crear curso"}
              </button>
            </div>

            {state.error && (
              <p id="course-form-error" className="form-error" role="alert">
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
                <div className="card mt-4 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-[#4d7cfe1c] text-[#7fa4ff]">
                      <CourseIcon name={icon} className="size-6" />
                    </span>
                    <span className="rounded-full bg-[#4d7cfe1c] px-2.5 py-1 text-[11px] font-semibold text-[#7fa4ff]">
                      Nivel {level}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold leading-snug text-ink">
                    {title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {description.trim() || "Preparando ruta de aprendizaje."}
                  </p>
                  {usesBase && (
                    <span className="badge badge-neutral mt-2">Contenido base</span>
                  )}
                </div>
              ) : (
                <div className="card mt-4 rounded-2xl p-4">
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
