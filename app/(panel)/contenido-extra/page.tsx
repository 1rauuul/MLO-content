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
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Contenido extra</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Agrega bloques, ejemplos o ejercicios a una lección existente del curso base y
          elige a qué clases se asignan. No se crean lecciones ni subtemas nuevos.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          Primero crea una clase en{" "}
          <Link href="/clases" className="text-zinc-900 underline">
            Clases
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
          <h2 className="font-medium text-zinc-900">Contenido agregado</h2>
          <p className="text-sm text-zinc-500">
            {extras.length} {extras.length === 1 ? "contenido" : "contenidos"}. Editar uno
            lo actualiza en todas sus clases al volver a publicarlas.
          </p>
        </div>

        {extras.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            Todavía no has agregado contenido extra.
          </p>
        ) : (
          <ul className="space-y-3">
            {extras.map((extra) => (
              <li key={extra.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {TYPE_LABEL[extra.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900">{extraSummary(extra)}</p>
                    <p className="text-xs text-zinc-500">
                      Lección <span className="font-mono">{extra.lesson_code}</span> ·{" "}
                      {extra.lesson_title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Clases: {extra.class_names.join(", ") || "sin asignar"}
                    </p>
                  </div>
                  <Link
                    href={`/contenido-extra?extra=${extra.id}`}
                    className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                  >
                    Editar
                  </Link>
                  <form action={deleteExtra}>
                    <input type="hidden" name="extraId" value={extra.id} />
                    <button className="text-sm text-red-600 underline-offset-2 hover:underline">
                      Borrar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
