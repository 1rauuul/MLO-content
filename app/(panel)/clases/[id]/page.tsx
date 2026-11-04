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
      <header>
        <Link href="/clases" className="text-sm text-ink-muted hover:text-ink">
          ← Clases
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{klass.name}</h1>
          <span className="rounded-lg bg-surface px-2 py-1 font-mono text-sm tracking-widest text-ink-soft ring-1 ring-line">
            {klass.join_code}
          </span>
          {teacher.role === "admin" && (
            <span className="text-xs text-ink-faint">Docente: {klass.teacher_name}</span>
          )}
        </div>
        <p className="page-lead">
          Comparte el código para que los alumnos se unan. Los cambios se ven cuando publicas.
        </p>
      </header>

      <section className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Publicación</h2>
          {last ? (
            <p className="mt-1 text-sm text-ink-muted">
              Versión <strong className="text-ink-soft">{last.version}</strong> ·{" "}
              {formatDate(last.published_at)} · hash{" "}
              <span className="font-mono text-xs">{last.content_hash.slice(0, 12)}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">
              Todavía no hay una versión publicada.
            </p>
          )}
          <p className="mt-2">
            {pending ? (
              <span className="badge badge-warning">Hay cambios sin publicar</span>
            ) : last ? (
              <span className="badge badge-positive">Publicado</span>
            ) : null}
          </p>
        </div>
        <PublishClassForm classId={klass.id} />
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Contenido de la clase</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {extras.length}{" "}
              {extras.length === 1 ? "contenido asignado" : "contenidos asignados"}.
            </p>
          </div>
          <Link href={`/contenido-extra?classId=${klass.id}`} className="btn btn-primary btn-sm">
            Agregar contenido
          </Link>
        </div>

        {extras.length === 0 ? (
          <p className="empty mt-4">Esta clase todavía no tiene contenido extra.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {extras.map((extra) => (
              <li key={extra.id} className="flex flex-wrap items-start gap-3 py-3">
                <span className="badge badge-neutral">{TYPE_LABEL[extra.type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{extraSummary(extra)}</p>
                  <p className="text-xs text-ink-muted">
                    Lección <span className="font-mono">{extra.lesson_code}</span> ·{" "}
                    {extra.lesson_title}
                  </p>
                  {extra.class_names.length > 0 && (
                    <p className="text-xs text-ink-faint">
                      También en: {extra.class_names.join(", ")}
                    </p>
                  )}
                </div>
                <Link
                  href={`/contenido-extra?extra=${extra.id}`}
                  className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Alumnos</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {students.length} {students.length === 1 ? "alumno" : "alumnos"} en esta clase.
        </p>

        {students.length === 0 ? (
          <p className="empty mt-4">
            Todavía no se ha unido nadie con el código {klass.join_code}.
          </p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="eyebrow py-2 font-medium">Nombre</th>
                <th className="eyebrow py-2 font-medium">Se unió</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((student) => (
                <tr key={student.id} className="transition-colors hover:bg-surface-soft/70">
                  <td className="py-2 text-ink-soft">{student.name}</td>
                  <td className="py-2 text-ink-muted">{formatDate(student.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
