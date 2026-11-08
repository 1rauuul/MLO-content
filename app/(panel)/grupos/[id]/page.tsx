import Link from "next/link";

import { BackLink } from "@/app/(panel)/back-link";
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

import { InvitationHistory, InvitationPanel } from "./invitation-panel";
import { PublishClassForm } from "./publish-class-form";

const TYPE_LABEL = {
  lesson: "Lección",
  example: "Ejemplo",
  exercise: "Ejercicio",
} as const;

type GroupTopic = {
  id: string;
  title: string;
  lesson_count: number;
};

type GroupUnit = {
  id: string;
  number: number;
  title: string;
  topics: GroupTopic[];
};

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

  let units: GroupUnit[] = [];
  if (klass.content_course_id) {
    const unitRows = await db()<{ id: string; number: number; title: string }[]>`
      select id, number, title
        from units
       where course_id = ${klass.content_course_id}
         and archived_at is null
       order by number, position, id`;
    const topicRows = await db()<
      { id: string; unit_id: string; title: string; lesson_count: number }[]
    >`
      select t.id, t.unit_id, t.title,
             (select count(*)::int
                from lessons l
               where l.topic_id = t.id and l.archived_at is null) as lesson_count
        from topics t
       where t.course_id = ${klass.content_course_id}
         and t.archived_at is null
       order by t.position, t.id`;

    units = unitRows.map((unit) => ({
      ...unit,
      topics: topicRows.filter((topic) => topic.unit_id === unit.id),
    }));
  }

  const topicCount = units.reduce((total, unit) => total + unit.topics.length, 0);

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/grupos">Grupos</BackLink>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{klass.name}</h1>
          <span className="rounded-lg bg-surface px-2 py-1 font-mono text-sm tracking-widest text-ink-soft ring-1 ring-line">
            {klass.join_code}
          </span>
          {teacher.role === "admin" && (
            <span className="text-xs text-ink-faint">Docente: {klass.teacher_name}</span>
          )}
          <span className="text-xs text-ink-muted">Curso: {klass.course_title}</span>
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
          Comparte el código para que los alumnos se unan. Los cambios se ven cuando
          publicas.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Contenido del grupo</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Unidades, subtemas, lecciones y actividades propias del grupo.
                </p>
              </div>
              {klass.content_course_id ? (
                <Link
                  href={`/cursos/${klass.content_course_id}`}
                  className="btn btn-secondary btn-sm"
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
            </div>

            {klass.content_course_id && (
              <details open className="group mt-4 border-t border-line pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-medium text-ink">
                    Unidades y subtemas
                  </span>
                  <span className="flex items-center gap-2 text-xs tabular-nums text-ink-muted">
                    {units.length} {units.length === 1 ? "unidad" : "unidades"} ·{" "}
                    {topicCount} {topicCount === 1 ? "subtema" : "subtemas"}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>

                {units.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-muted">
                    Todavía no hay unidades ni subtemas.
                    <Link
                      href={`/cursos/${klass.content_course_id}`}
                      className="link ml-1"
                    >
                      Crear la estructura
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {units.map((unit) => (
                      <div
                        key={unit.id}
                        className="rounded-xl border border-line bg-surface-soft/40 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface font-mono text-xs font-medium text-ink-soft ring-1 ring-line">
                            {unit.number}
                          </span>
                          <h3 className="text-sm font-medium text-ink">{unit.title}</h3>
                          <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-faint">
                            {unit.topics.length}{" "}
                            {unit.topics.length === 1 ? "subtema" : "subtemas"}
                          </span>
                        </div>

                        {unit.topics.length === 0 ? (
                          <p className="mt-2 pl-10 text-xs text-ink-faint">
                            Sin subtemas todavía.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1 border-l border-line pl-4">
                            {unit.topics.map((topic) => (
                              <li key={topic.id}>
                                <Link
                                  href={`/cursos/${klass.content_course_id}/temas/${topic.id}`}
                                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                                >
                                  <span>{topic.title}</span>
                                  <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                                    {topic.lesson_count}{" "}
                                    {topic.lesson_count === 1 ? "lección" : "lecciones"}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </details>
            )}
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Contenido adicional</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {extras.length}{" "}
                  {extras.length === 1
                    ? "contenido adicional asignado"
                    : "contenidos adicionales asignados"}
                  .
                </p>
              </div>
              <Link
                href={`/contenido-extra?classId=${klass.id}`}
                className="btn btn-secondary btn-sm"
              >
                Agregar contenido
              </Link>
            </div>

            {extras.length === 0 ? (
              <p className="empty mt-4">
                Este grupo todavía no tiene contenido adicional.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {extras.map((extra) => (
                  <li key={extra.id} className="flex flex-wrap items-start gap-3 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {TYPE_LABEL[extra.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {extraSummary(extra)}
                      </p>
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

            <div className="mt-5 border-t border-line pt-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Publicación</h3>
                  {last ? (
                    <p className="mt-1 text-sm text-ink-muted">
                      Versión v2{" "}
                      <strong className="tabular-nums text-ink-soft">
                        {last.version}
                      </strong>{" "}
                      ·{" "}
                      <span className="tabular-nums">
                        {formatDate(last.published_at)}
                      </span>{" "}
                      · hash{" "}
                      <span className="font-mono text-xs">
                        {last.content_hash.slice(0, 12)}
                      </span>
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
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                        <span className="size-1.5 rounded-full bg-ink-faint" />
                        Sin publicar
                      </span>
                    )}
                  </p>
                </div>
                {!klass.archived_at ? (
                  <PublishClassForm classId={klass.id} />
                ) : (
                  <p className="max-w-52 text-sm text-ink-muted">
                    Restaura el grupo para publicar.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
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
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="eyebrow py-2 font-medium">Nombre</th>
                      <th className="eyebrow py-2 font-medium">Se unió</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {students.map((student) => (
                      <tr
                        key={student.id}
                        className="transition-colors hover:bg-surface-soft/70"
                      >
                        <td className="py-2 text-ink-soft">{student.name}</td>
                        <td className="whitespace-nowrap py-2 tabular-nums text-ink-muted">
                          {formatDate(student.joined_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <InvitationPanel
            classId={klass.id}
            disabled={Boolean(klass.archived_at)}
          />

          <InvitationHistory
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
      </div>
    </div>
  );
}
