import Link from "next/link";

import { BackLink } from "@/app/(panel)/back-link";
import { moveTopic, moveUnit } from "@/lib/actions/content";
import { unpublish } from "@/lib/actions/publish";
import { canEditCourse, getBaseCourseId, getCourseForRead } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { editorCourseIds } from "@/lib/content/x03";
import { db } from "@/lib/db";

import { CreateTopicForm } from "./create-topic-form";
import { TopicContentLink } from "./topic-content-link";
import { CreateUnitForm } from "./unit-form";

type UnitRow = {
  id: string;
  course_id: string;
  number: number;
  title: string;
  description: string;
  difficulty: string;
  color: string;
};

type TopicRow = {
  id: string;
  course_id: string;
  unit_id: string;
  title: string;
  summary: string;
  position: number;
};

type ClassRow = {
  id: string;
  name: string;
  course_id: string;
  content_course_id: string | null;
};

function MoveButtons({
  action,
  fields,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
}) {
  return (
    <span className="flex items-center gap-1">
      {(["up", "down"] as const).map((direction) => (
        <form action={action} key={direction}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="direction" value={direction} />
          <button type="submit" className="btn btn-ghost btn-sm" aria-label={`Mover ${direction}`}>
            {direction === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </span>
  );
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;

  const course = await getCourseForRead(teacher, id);
  const canEdit = canEditCourse(teacher, course);
  const [coreId] = editorCourseIds(
    course.is_group,
    course.id,
    await getBaseCourseId(),
  );
  const [units, topics, assignedGroups] = await Promise.all([
    db()<UnitRow[]>`
    select id, course_id, number, title, description, difficulty, color
      from units
     where course_id in (${course.id}, ${coreId})
       and archived_at is null
     order by number, position, id`,
    db()<TopicRow[]>`
    select id, course_id, unit_id, title, summary, position
      from topics
     where course_id in (${course.id}, ${coreId})
       and archived_at is null
     order by position, id`,
    db()<ClassRow[]>`
      select id, name, course_id, content_course_id
        from classes
       where (course_id = ${course.id} or content_course_id = ${course.id})
         and archived_at is null
       order by name`,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/mis-cursos">Mis cursos</BackLink>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{course.title}</h1>
          {course.is_group && <span className="badge badge-neutral">Grupo</span>}
          {!canEdit && <span className="badge badge-warning">Solo lectura</span>}
          <Link
            href={`/cursos/${course.id}/referencias`}
            className="btn btn-secondary btn-sm"
          >
            Referencias
          </Link>
          {canEdit && !course.is_group && course.status === "published" && (
            <form action={unpublish} className="ml-auto">
              <input type="hidden" name="courseId" value={course.id} />
              <button type="submit" className="btn btn-secondary btn-sm">
                Despublicar
              </button>
            </form>
          )}
          {canEdit && !course.is_group && (
            <Link
              href={`/cursos/${course.id}/publicar`}
              className={`btn btn-primary btn-sm ${course.status === "published" ? "" : "ml-auto"}`}
            >
              Publicar
            </Link>
          )}
        </div>
        {course.description && <p className="page-lead">{course.description}</p>}
      </header>

      {canEdit && <CreateUnitForm courseId={course.id} />}

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Grupos asignados</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Estos grupos dependen de este curso para su contenido.
        </p>
        {assignedGroups.length === 0 ? (
          <p className="empty mt-3">Todavía no hay grupos asignados a este curso.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {assignedGroups.map((group) => (
              <li key={group.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href={`/grupos/${group.id}`} className="text-ink-soft underline-offset-4 hover:underline">
                  {group.name}
                </Link>
                {group.content_course_id === course.id && (
                  <span className="text-xs text-ink-faint">Contenido propio</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {units.length === 0 ? (
        <p className="empty">Este curso todavía no tiene unidades.</p>
      ) : (
        <div className="space-y-4">
          {units.map((unit) => {
            const unitTopics = topics.filter((topic) => topic.unit_id === unit.id);
            const isCore = unit.course_id !== course.id;

            return (
              <section key={unit.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-soft font-mono text-xs font-medium text-ink-soft ring-1 ring-line">
                    {unit.number}
                  </span>
                  <h2 className="text-sm font-semibold text-ink">{unit.title}</h2>
                  <span className="text-xs text-ink-faint">
                    {unit.difficulty} · {unit.color}
                  </span>
                  {isCore && (
                    <span className="text-[11px] text-ink-faint">Contenido base</span>
                  )}
                  {canEdit && !isCore && (
                    <span className="ml-auto">
                      <MoveButtons
                        action={moveUnit}
                        fields={{ courseId: course.id, unitId: unit.id }}
                      />
                    </span>
                  )}
                </div>

                {unit.description && (
                  <p className="mt-2 text-sm text-ink-muted">{unit.description}</p>
                )}

                {unitTopics.length > 0 && (
                  <ul className="mt-4 divide-y divide-line border-t border-line">
                    {unitTopics.map((topic, index) => {
                      const own = topic.course_id === course.id;
                      return (
                        <li
                          key={topic.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                        >
                          <span className="text-ink-soft">
                            <span className="mr-2 font-mono text-xs text-ink-faint">
                              {unit.number}.{index + 1}
                            </span>
                            {topic.title}
                          </span>
                          <span className="flex flex-wrap items-center gap-2">
                            {canEdit && own && (
                              <>
                                {course.is_group && (
                                  <TopicContentLink
                                    topicId={topic.id}
                                    groups={assignedGroups
                                      .filter((group) => group.content_course_id === course.id)
                                      .map((group) => ({ id: group.id, name: group.name }))}
                                  />
                                )}
                                <MoveButtons
                                  action={moveTopic}
                                  fields={{ courseId: course.id, topicId: topic.id }}
                                />
                              </>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canEdit && <CreateTopicForm courseId={course.id} unitId={unit.id} />}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
