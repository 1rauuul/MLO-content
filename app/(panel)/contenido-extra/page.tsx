import Link from "next/link";

import { deleteExtra } from "@/lib/actions/classes";
import { requireTeacher } from "@/lib/auth";
import {
  extraSummary,
  getExtraForRead,
  listBaseLessons,
  listEditableClasses,
  listTeacherExtras,
} from "@/lib/classes";
import type { ExtraPayload } from "@/lib/content/classes";

import { ExtraForm } from "./extra-form";

const TYPE_LABEL = {
  lesson: "Lección",
  example: "Ejemplo",
  exercise: "Ejercicio",
} as const;

export default async function ContenidoExtraPage({
  searchParams,
}: {
  searchParams: Promise<{ extra?: string; classId?: string }>;
}) {
  const teacher = await requireTeacher();
  const { extra: extraId, classId } = await searchParams;

  const [classes, lessons, extras, editing] = await Promise.all([
    listEditableClasses(teacher),
    listBaseLessons(),
    listTeacherExtras(teacher),
    extraId ? getExtraForRead(teacher, extraId) : Promise.resolve(null),
  ]);

  const preselected =
    classId && classes.some((klass) => klass.id === classId) ? classId : undefined;

  const initial = editing
    ? {
        id: editing.id,
        type: editing.type,
        lessonId: editing.lesson_id,
        classIds: editing.class_ids,
        payload: editing.payload as ExtraPayload,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Contenido extra</h1>
        <p className="page-lead">
          Agrega bloques, ejemplos o ejercicios a una lección existente del curso base y
          elige a qué grupos se asignan. No se crean lecciones ni subtemas nuevos.
        </p>
      </header>

      {classes.length === 0 ? (
        <p className="empty">
          Primero crea un grupo en{" "}
          <Link href="/grupos" className="link">
            Grupos
          </Link>
          .
        </p>
      ) : (
        <ExtraForm
          key={initial?.id ?? "nuevo"}
          classes={classes}
          lessons={lessons}
          initial={initial}
          preselectedClassId={preselected}
        />
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Contenido agregado</h2>
          <p className="text-sm text-ink-muted">
            {extras.length} {extras.length === 1 ? "contenido" : "contenidos"}. Editar uno
            lo actualiza en todos sus grupos al volver a publicarlos.
          </p>
        </div>

        {extras.length === 0 ? (
          <p className="empty">
            Todavía no has agregado contenido extra.
          </p>
        ) : (
          <ul className="space-y-3">
            {extras.map((extra) => (
              <li key={extra.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="badge badge-neutral">
                    {TYPE_LABEL[extra.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{extraSummary(extra)}</p>
                    <p className="text-xs text-ink-muted">
                      Lección <span className="font-mono">{extra.lesson_code}</span> ·{" "}
                      {extra.lesson_title}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Grupos: {extra.class_names.join(", ") || "sin asignar"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/contenido-extra?extra=${extra.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Editar
                    </Link>
                    <form action={deleteExtra}>
                      <input type="hidden" name="extraId" value={extra.id} />
                      <button className="btn btn-danger btn-sm">Borrar</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
