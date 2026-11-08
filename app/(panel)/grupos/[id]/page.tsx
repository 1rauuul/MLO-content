import Link from "next/link";

import { archiveClass, createClassContent, restoreClass } from "@/lib/actions/classes";
import { requireTeacher } from "@/lib/auth";
import {
  draftClassHash,
  extraSummary,
  getClassForRead,
  getLatestClassRelease,
  listClassExtras,
  listClassStudents,
} from "@/lib/classes";
import { db } from "@/lib/db";
import { listInvitations } from "@/lib/invitations/invitations";

import { InvitationPanel } from "./invitation-panel";
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
  const [last, students, extras, invitations] = await Promise.all([
    getLatestClassRelease(klass.id),
    listClassStudents(klass.id),
    listClassExtras(klass.id),
    listInvitations(klass.id),
  ]);

  const draftHash = draftClassHash(klass, extras);
  const pending = last ? draftHash !== last.content_hash : extras.length > 0;
  const [v3] = await db()<{ version: number; content_hash: string }[]>`
    select version, content_hash
      from class_releases_v3
     where class_id = ${klass.id}
     order by version desc
     limit 1`;

  return (
    <div className="space-y-6">
      <header>
        <Link href="/grupos" className="text-sm text-ink-muted hover:text-ink">
          ← Grupos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{klass.name}</h1>
          <span className="rounded-lg bg-surface px-2 py-1 font-mono text-sm tracking-widest text-ink-soft ring-1 ring-line">
            {klass.join_code}
          </span>
          {teacher.role === "admin" && (
            <span className="text-xs text-ink-faint">Docente: {klass.teacher_name}</span>
          )}
          <span className="text-xs text-ink-muted">Curso: {klass.course_title}</span>
          <span className="text-xs tabular-nums text-ink-muted">
            {klass.capacity === null ? "Sin cupo" : `Cupo ${klass.capacity}`}
          </span>
          {klass.archived_at && <span className="badge badge-warning">Archivado</span>}
          <form
            action={klass.archived_at ? restoreClass : archiveClass}
            className="ml-auto"
          >
            <input type="hidden" name="classId" value={klass.id} />
            <button type="submit" className="btn btn-secondary btn-sm">
              {klass.archived_at ? "Restaurar" : "Archivar"}
            </button>
          </form>
        </div>
        <p className="page-lead">
          Comparte el código para que los alumnos se unan. Los cambios se ven cuando publicas.
        </p>
      </header>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Contenido del grupo</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Unidades, subtemas, lecciones y actividades propias del grupo.
          </p>
        </div>
        {klass.content_course_id ? (
          <Link
            href={`/cursos/${klass.content_course_id}`}
            className="btn btn-primary btn-sm"
          >
            Editar contenido
          </Link>
        ) : (
          <form action={createClassContent}>
            <input type="hidden" name="classId" value={klass.id} />
            <button type="submit" className="btn btn-primary btn-sm">
              Crear contenido
            </button>
          </form>
        )}
      </section>

      <section className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Publicación</h2>
          {last ? (
            <p className="mt-1 text-sm text-ink-muted">
              Versión v2{" "}
              <strong className="tabular-nums text-ink-soft">{last.version}</strong> ·{" "}
              <span className="tabular-nums">{formatDate(last.published_at)}</span> · hash{" "}
              <span className="font-mono text-xs">{last.content_hash.slice(0, 12)}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">
              Todavía no hay una versión publicada.
            </p>
          )}
          <p className="mt-1 text-sm tabular-nums text-ink-muted">
            {v3
              ? `Release v3 de grupo: versión ${v3.version} · hash ${v3.content_hash.slice(0, 12)}.`
              : "Release v3 de grupo: pendiente de publicar."}
          </p>
          <p className="mt-2">
            {pending ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-warning">
                <span className="size-1.5 rounded-full bg-warning" />
                Hay cambios sin publicar
              </span>
            ) : last ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-positive">
                <span className="size-1.5 rounded-full bg-positive" />
                Publicado
              </span>
            ) : null}
          </p>
        </div>
        {!klass.archived_at ? (
          <PublishClassForm classId={klass.id} />
        ) : (
          <p className="text-sm text-ink-muted">Restaura el grupo para publicar.</p>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Contenido extra del grupo</h2>
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
          <p className="empty mt-4">Este grupo todavía no tiene contenido extra.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {extras.map((extra) => (
              <li key={extra.id} className="flex flex-wrap items-start gap-3 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  {TYPE_LABEL[extra.type]}
                </span>
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
          <span className="tabular-nums">{students.length}</span>{" "}
          {students.length === 1 ? "alumno" : "alumnos"} en este grupo.
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

      <InvitationPanel
        classId={klass.id}
        disabled={Boolean(klass.archived_at)}
        invitations={invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expires_at.toISOString(),
          status: invitation.status,
        }))}
      />
    </div>
  );
}
