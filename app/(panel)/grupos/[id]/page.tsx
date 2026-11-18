import Link from "next/link";

import { BackLink } from "@/app/(panel)/back-link";
import { archiveClass, createClassContent, restoreClass } from "@/lib/actions/classes";
import { getBaseCourseId } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import {
  getClassForRead,
  getLatestClassRelease,
  listClassStudents,
} from "@/lib/classes";
import { db } from "@/lib/db";
import { listInvitations } from "@/lib/invitations/invitations";

import { InvitationHistory, InvitationPanel } from "./invitation-panel";
import { PublishClassForm } from "./publish-class-form";

type GroupTopic = {
  id: string;
  title: string;
  lesson_count: number;
  activity_count: number;
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

type PublishedTopic = { label: string; activities: number };

function VersionCard({
  status,
  tone,
  date,
  topics,
}: {
  status: string;
  tone: "positive" | "warning";
  date: Date;
  topics: PublishedTopic[];
}) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Versión del grupo</h2>
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${
            tone === "positive" ? "text-positive" : "text-warning"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              tone === "positive" ? "bg-positive" : "bg-warning"
            }`}
          />
          {status}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Último cambio: <span className="tabular-nums">{formatDate(date)}</span>
      </p>
      <PublishedTopics topics={topics} />
    </section>
  );
}

function PublishedTopics({ topics }: { topics: PublishedTopic[] }) {
  if (topics.length === 0) {
    return <p className="mt-2 text-sm text-ink-muted">Todavía no hay subtemas.</p>;
  }

  const visible = topics.slice(0, 3);
  const rest = topics.slice(3);

  const renderItem = (topic: PublishedTopic) => (
    <li key={topic.label}>
      <span className="font-mono text-xs text-ink-faint">{topic.label}</span> ·{" "}
      {topic.activities} {topic.activities === 1 ? "actividad" : "actividades"}
    </li>
  );

  return (
    <div className="mt-2">
      <ul className="space-y-1 text-sm text-ink-muted">
        {visible.map(renderItem)}
      </ul>
      {rest.length > 0 && (
        <details className="group/more mt-1">
          <summary className="cursor-pointer list-none text-xs text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open/more:hidden">Mostrar más</span>
            <span className="hidden group-open/more:inline">Mostrar menos</span>
          </summary>
          <ul className="mt-1 space-y-1 text-sm text-ink-muted">
            {rest.map(renderItem)}
          </ul>
        </details>
      )}
    </div>
  );
}

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;

  const klass = await getClassForRead(teacher, id);
  const [last, students, invitations] = await Promise.all([
    getLatestClassRelease(klass.id),
    listClassStudents(klass.id),
    listInvitations(klass.id),
  ]);

  const [v3] = await db()<{ published_at: Date }[]>`
    select published_at
      from class_releases_v3
     where class_id = ${klass.id}
     order by version desc
     limit 1`;

  const changeRows = v3
    ? await db()<{ topic_id: string; changed_at: Date }[]>`
        select topic_id, max(changed_at) as changed_at
          from class_content_changes
         where class_id = ${klass.id}
           and changed_at > ${v3.published_at}
         group by topic_id
         order by changed_at desc`
    : await db()<{ topic_id: string; changed_at: Date }[]>`
        select topic_id, max(changed_at) as changed_at
          from class_content_changes
         where class_id = ${klass.id}
         group by topic_id
         order by changed_at desc`;

  const [parentCourse] = await db()<
    { uses_base: boolean; owner_id: string | null; is_base: boolean }[]
  >`
    select uses_base, owner_id, is_base from courses where id = ${klass.course_id} limit 1`;
  const baseId = parentCourse?.uses_base ? await getBaseCourseId() : null;
  const canEditStructure =
    parentCourse &&
    (teacher.role === "admin" || (!parentCourse.is_base && parentCourse.owner_id === teacher.id));
  const scope = [
    klass.course_id,
    ...(baseId ? [baseId] : []),
    ...(klass.content_course_id ? [klass.content_course_id] : []),
  ];

  const unitRows = await db()<{ id: string; number: number; title: string }[]>`
    select id, number, title
      from units
     where course_id in ${db()(scope)}
       and archived_at is null
     order by number, position, id`;
  const topicRows = await db()<
    {
      id: string;
      unit_id: string;
      title: string;
      lesson_count: number;
      example_count: number;
      exercise_count: number;
      evaluation_count: number;
    }[]
  >`
    select t.id, t.unit_id, t.title,
           (select count(*)::int
              from lessons l
             where l.topic_id = t.id and l.archived_at is null
               and l.course_id in ${db()(scope)}) as lesson_count,
           (select count(*)::int
              from examples e
             where e.topic_id = t.id and e.archived_at is null
               and e.course_id in ${db()(scope)}) as example_count,
           (select count(*)::int
              from exercises x
             where x.topic_id = t.id and x.archived_at is null
               and x.course_id in ${db()(scope)}) as exercise_count,
           (select count(*)::int
              from evaluations ev
             where ev.topic_id = t.id and ev.archived_at is null
               and ev.course_id in ${db()(scope)}) as evaluation_count
      from topics t
     where t.course_id in ${db()(scope)}
       and t.archived_at is null
     order by t.position, t.id`;

  const units: GroupUnit[] = unitRows.map((unit) => ({
    ...unit,
    topics: topicRows
      .filter((topic) => topic.unit_id === unit.id)
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        lesson_count: topic.lesson_count,
        activity_count:
          topic.example_count + topic.exercise_count + topic.evaluation_count,
      })),
  }));

  const topicCount = units.reduce((total, unit) => total + unit.topics.length, 0);
  const publishedTopics = units.flatMap((unit) =>
    unit.topics.map((topic, index) => ({
      id: topic.id,
      label: `${unit.number}.${index + 1}`,
      activities: topic.activity_count,
    })),
  );
  const changedTopicIds = new Set(changeRows.map((row) => row.topic_id));
  const pendingTopics = publishedTopics.filter((topic) => changedTopicIds.has(topic.id));
  const pendingChangedAt = changeRows[0]?.changed_at ?? null;

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
          <div className="ml-auto flex flex-wrap items-start gap-2">
            {!klass.archived_at && (
              <PublishClassForm classId={klass.id} joinCode={klass.join_code} />
            )}
            <form action={klass.archived_at ? restoreClass : archiveClass}>
              <input type="hidden" name="classId" value={klass.id} />
              <button type="submit" className="btn btn-secondary btn-sm">
                {klass.archived_at ? "Restaurar" : "Archivar"}
              </button>
            </form>
          </div>
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
                  Unidades, subtemas, lecciones y actividades del curso y del grupo.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {klass.content_course_id ? (
                  <Link
                    href={`/grupos/${klass.id}/contenido`}
                    className="btn btn-secondary btn-sm"
                  >
                    Editar contenido
                  </Link>
                ) : (
                  <form action={createClassContent}>
                    <input type="hidden" name="classId" value={klass.id} />
                    <input
                      type="hidden"
                      name="volver"
                      value={`/grupos/${klass.id}`}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Crear contenido
                    </button>
                  </form>
                )}
                {canEditStructure && (
                  <Link
                    href={`/cursos/${klass.course_id}?vista=estructura&volver=${encodeURIComponent(
                      `/grupos/${klass.id}`,
                    )}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Editar estructura
                  </Link>
                )}
                <Link
                  href={`/contenido-extra?classId=${klass.id}`}
                  className="btn btn-primary btn-sm"
                >
                  Agregar contenido
                </Link>
              </div>
            </div>

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
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {units.map((unit) => (
                    <details
                      key={unit.id}
                      className="group/unit rounded-xl border border-line bg-surface-soft/40"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface font-mono text-xs font-medium text-ink-soft ring-1 ring-line">
                          {unit.number}
                        </span>
                        <h3 className="min-w-0 truncate text-sm font-medium text-ink">{unit.title}</h3>
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-faint">
                          {unit.topics.length}{" "}
                          {unit.topics.length === 1 ? "subtema" : "subtemas"}
                        </span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-4 shrink-0 text-ink-faint transition-transform group-open/unit:rotate-180"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </summary>

                      {unit.topics.length === 0 ? (
                        <p className="px-4 pb-4 pl-14 text-xs text-ink-faint">
                          Sin subtemas todavía.
                        </p>
                      ) : (
                        <ul className="mx-4 mb-4 space-y-1 border-l border-line pl-4">
                          {unit.topics.map((topic, index) => (
                            <li
                              key={topic.id}
                              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1.5 text-sm text-ink-soft"
                            >
                              <span className="min-w-0">
                                <span className="mr-2 font-mono text-xs text-ink-faint">
                                  {unit.number}.{index + 1}
                                </span>
                                {topic.title}
                              </span>
                              <span className="shrink-0 text-right text-xs tabular-nums text-ink-faint">
                                {topic.lesson_count}{" "}
                                {topic.lesson_count === 1 ? "lección" : "lecciones"} ·{" "}
                                {topic.activity_count}{" "}
                                {topic.activity_count === 1 ? "actividad" : "actividades"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  ))}
                </div>
              )}
            </details>
          </section>

          {pendingChangedAt && pendingTopics.length > 0 && (
            <VersionCard
              status="Sin publicar"
              tone="warning"
              date={pendingChangedAt}
              topics={pendingTopics}
            />
          )}

          {v3 ? (
            <VersionCard
              status="Disponible"
              tone="positive"
              date={v3.published_at}
              topics={publishedTopics}
            />
          ) : (
            !pendingChangedAt && (
              <section className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-ink">Versión del grupo</h2>
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                    <span className="size-1.5 rounded-full bg-ink-faint" />
                    No disponible
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Aún no has publicado este grupo.
                </p>
              </section>
            )
          )}
        </div>

        <div className="space-y-5">
          <InvitationPanel
            classId={klass.id}
            disabled={Boolean(klass.archived_at)}
            published={Boolean(last)}
          />

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

          <InvitationHistory
            classId={klass.id}
            disabled={Boolean(klass.archived_at)}
            invitations={invitations.map((invitation) => ({
              id: invitation.id,
              email: invitation.email,
              expiresAt: invitation.expires_at.toISOString(),
              status: invitation.status,
              sentAt: invitation.sent_at?.toISOString() ?? null,
              deliveryError: invitation.delivery_error,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
