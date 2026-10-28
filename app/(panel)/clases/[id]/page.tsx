import Link from "next/link";

import { requireTeacher } from "@/lib/auth";
import {
  draftClassHash,
  extraSummary,
  getClassForRead,
  getLatestClassRelease,
  listClassExtras,
  listClassStudents,
} from "@/lib/classes";

import { PublishClassForm } from "./publish-class-form";

const TYPE_LABEL = {
  lesson: "Lección",
  example: "Ejemplo",
  exercise: "Ejercicio",
} as const;

function formatDate(value: Date): string {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;

  const klass = await getClassForRead(teacher, id);
  const [last, students, extras] = await Promise.all([
    getLatestClassRelease(klass.id),
    listClassStudents(klass.id),
    listClassExtras(klass.id),
  ]);

  const draftHash = draftClassHash(klass, extras);
  const pending = last ? draftHash !== last.content_hash : extras.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clases" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Clases
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">{klass.name}</h1>
          <span className="rounded-lg bg-white px-2 py-1 font-mono text-sm tracking-widest text-zinc-800 ring-1 ring-zinc-200">
            {klass.join_code}
          </span>
          {teacher.role === "admin" && (
            <span className="text-xs text-zinc-500">Docente: {klass.teacher_name}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Comparte el código para que los alumnos se unan. Los cambios se ven cuando publicas.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-medium text-zinc-900">Publicación</h2>
            {last ? (
              <p className="mt-1 text-sm text-zinc-500">
                Versión <strong className="text-zinc-800">{last.version}</strong> ·{" "}
                {formatDate(last.published_at)} · hash{" "}
                <span className="font-mono text-xs">{last.content_hash.slice(0, 12)}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Todavía no hay una versión publicada.</p>
            )}
            <p className="mt-1 text-sm">
              {pending ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                  Hay cambios sin publicar
                </span>
              ) : last ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                  Publicado
                </span>
              ) : null}
            </p>
          </div>
          <PublishClassForm classId={klass.id} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-zinc-900">Contenido de la clase</h2>
            <p className="text-sm text-zinc-500">
              {extras.length}{" "}
              {extras.length === 1 ? "contenido asignado" : "contenidos asignados"}.
            </p>
          </div>
          <Link
            href={`/contenido-extra?classId=${klass.id}`}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Agregar contenido
          </Link>
        </div>

        {extras.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            Esta clase todavía no tiene contenido extra.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {extras.map((extra) => (
              <li key={extra.id} className="flex flex-wrap items-start gap-3 py-3">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {TYPE_LABEL[extra.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{extraSummary(extra)}</p>
                  <p className="text-xs text-zinc-500">
                    Lección <span className="font-mono">{extra.lesson_code}</span> ·{" "}
                    {extra.lesson_title}
                  </p>
                  {extra.class_names.length > 0 && (
                    <p className="text-xs text-zinc-400">
                      También en: {extra.class_names.join(", ")}
                    </p>
                  )}
                </div>
                <Link
                  href={`/contenido-extra?extra=${extra.id}`}
                  className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-medium text-zinc-900">Alumnos</h2>
        <p className="text-sm text-zinc-500">
          {students.length} {students.length === 1 ? "alumno" : "alumnos"} en esta clase.
        </p>

        {students.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            Todavía no se ha unido nadie con el código {klass.join_code}.
          </p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-2 font-medium">Nombre</th>
                <th className="py-2 font-medium">Se unió</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="py-2 text-zinc-800">{student.name}</td>
                  <td className="py-2 text-zinc-500">{formatDate(student.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
