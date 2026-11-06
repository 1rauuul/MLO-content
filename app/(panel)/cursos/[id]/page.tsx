import Link from "next/link";

import { revokeCourseAccess } from "@/lib/actions/access";
import { moveTopic, moveUnit } from "@/lib/actions/content";
import { unpublish } from "@/lib/actions/publish";
import { canEditCourse, getBaseCourseId, getCourseForRead } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { editorCourseIds } from "@/lib/content/x03";
import { listCourseAccess } from "@/lib/course-access";
import { db } from "@/lib/db";

import { GrantAccessForm } from "./access-form";
import { CreateTopicForm } from "./create-topic-form";
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
  const access = canEdit ? await listCourseAccess(course.id) : [];
  const statusLabel =
    course.status === "published"
      ? "Publicado"
      : course.status === "unpublished"
        ? "Despublicado"
        : "Borrador";
  const statusClass =
    course.status === "published"
      ? "badge badge-positive"
      : course.status === "unpublished"
        ? "badge badge-warning"
        : "badge badge-neutral";

  const units = await db()<UnitRow[]>`
    select id, course_id, number, title, description, difficulty, color
      from units
     where course_id in (${course.id}, ${coreId})
       and archived_at is null
     order by number, position, id`;
  const topics = await db()<TopicRow[]>`
    select id, course_id, unit_id, title, summary, position
      from topics
     where course_id in (${course.id}, ${coreId})
       and archived_at is null
     order by position, id`;
  const lessons = await db()<{ topic_id: string }[]>`
    select topic_id
      from lessons
     where course_id in (${course.id}, ${coreId})
       and archived_at is null`;
  const lessonCount = new Map<string, number>();
  for (const lesson of lessons) {
    lessonCount.set(lesson.topic_id, (lessonCount.get(lesson.topic_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/mis-cursos" className="text-sm text-ink-muted hover:text-ink">
          ← Mis cursos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{course.title}</h1>
          <span className="font-mono text-xs text-ink-faint">{course.key}</span>
          {course.is_base && <span className="badge badge-neutral">Core</span>}
          {course.is_group && <span className="badge badge-neutral">Grupo</span>}
          <span className={statusClass}>{statusLabel}</span>
          <span className="badge badge-neutral">
            {course.uses_base ? "Con contenido base" : "Sin contenido base"}
          </span>
          {!canEdit && <span className="badge badge-warning">Solo lectura</span>}
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
      </header>

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
                  {isCore && <span className="badge badge-neutral">Core</span>}
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
                    {unitTopics.map((topic) => {
                      const own = topic.course_id === course.id;
                      return (
                        <li
                          key={topic.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                        >
                          <span className="text-ink-soft">
                            <Link
                              href={`/cursos/${course.id}/temas/${topic.id}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {topic.title}
                            </Link>
                            <span className="ml-2 text-xs text-ink-faint">
                              {lessonCount.get(topic.id) ?? 0} lecciones
                            </span>
                            {!own && <span className="badge badge-neutral ml-2">Core</span>}
                          </span>
                          {canEdit && own && (
                            <MoveButtons
                              action={moveTopic}
                              fields={{ courseId: course.id, topicId: topic.id }}
                            />
                          )}
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

      {canEdit && <CreateUnitForm courseId={course.id} />}

      {canEdit && !course.is_group && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink">Acceso</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Solo los alumnos con acceso pueden descubrir y descargar este curso
            cuando está publicado. El curso base conserva su regla de piloto.
          </p>

          {access.length === 0 ? (
            <p className="empty mt-3">Todavía no hay alumnos con acceso.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {access.map((student) => (
                <li
                  key={student.student_id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span className="text-ink-soft">
                    {student.name}
                    <span className="ml-2 font-mono text-[11px] text-ink-faint">
                      {student.external_key}
                    </span>
                  </span>
                  <form action={revokeCourseAccess}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="studentId" value={student.student_id} />
                    <button type="submit" className="btn btn-ghost btn-sm">
                      Revocar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <GrantAccessForm courseId={course.id} />
        </section>
      )}
    </div>
  );
}
