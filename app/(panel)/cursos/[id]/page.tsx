import Link from "next/link";

import { BackLink } from "@/app/(panel)/back-link";
import { MoveButtons } from "@/app/(panel)/move-buttons";
import { moveTopic, moveUnit } from "@/lib/actions/content";
import { archive } from "@/lib/actions/publish";
import { canEditCourse, getBaseCourseId, getCourseForRead } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { UNIT_COLOR_LABELS } from "@/lib/content/unit-colors";
import { editorCourseIds } from "@/lib/content/x03";
import { db } from "@/lib/db";

import { CreateTopicForm } from "./create-topic-form";
import { SaveCourseForm } from "./save-course-form";
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

const UNIT_COLOR_SWATCH: Record<string, string> = {
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  teal: "bg-teal-500",
};

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;

  const course = await getCourseForRead(teacher, id);
  const canEdit = canEditCourse(teacher, course);
  const isArchived = Boolean(course.archived_at);
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

  const contentGroups = assignedGroups.filter((group) =>
    course.is_group ? group.content_course_id === course.id : group.course_id === course.id,
  );
  const contentGroup =
    contentGroups.find((group) => group.content_course_id) ?? contentGroups[0];

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
          {canEdit && !course.is_group && !isArchived && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!course.is_base && (
                <form action={archive}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Archivar
                  </button>
                </form>
              )}
              <SaveCourseForm courseId={course.id} />
            </div>
          )}
        </div>
        {course.description && <p className="page-lead">{course.description}</p>}
      </header>

      <div className={canEdit && !isArchived ? "grid gap-6 lg:grid-cols-2 lg:items-start" : ""}>
        {canEdit && !isArchived && <CreateUnitForm courseId={course.id} />}

        <details className="card group overflow-hidden">
          <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-sm font-semibold text-ink">Grupos asignados</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Estos grupos dependen de este curso para su contenido.
              </p>
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-2 pt-0.5 text-xs tabular-nums text-ink-muted">
              {assignedGroups.length}{" "}
              {assignedGroups.length === 1 ? "grupo" : "grupos"}
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

          <div className="border-t border-line px-5 pb-5">
            {assignedGroups.length === 0 ? (
              <p className="empty mt-3">Todavía no hay grupos asignados a este curso.</p>
            ) : (
              <ul className="mt-1 max-h-64 divide-y divide-line overflow-y-auto">
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
          </div>
        </details>
      </div>

      {units.length === 0 ? (
        <p className="empty">Este curso todavía no tiene unidades.</p>
      ) : (
        <div className="space-y-4">
          {units.map((unit) => {
            const unitTopics = topics.filter((topic) => topic.unit_id === unit.id);
            const isCore = unit.course_id !== course.id;
            const colorLabel = UNIT_COLOR_LABELS[unit.color as keyof typeof UNIT_COLOR_LABELS] ?? unit.color;
            const colorSwatch = UNIT_COLOR_SWATCH[unit.color] ?? UNIT_COLOR_SWATCH.blue;

            return (
              <details key={unit.id} className="card group overflow-hidden">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="text-ink-faint transition-transform group-open:rotate-90" aria-hidden="true">
                    ▸
                  </span>
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-soft font-mono text-xs font-medium text-ink-soft ring-1 ring-line">
                    {unit.number}
                  </span>
                  <h2 className="text-sm font-semibold text-ink">{unit.title}</h2>
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                    <span className={`size-2 rounded-full ${colorSwatch}`} aria-hidden="true" />
                    {unit.difficulty} · {colorLabel}
                  </span>
                  {isCore && <span className="text-[11px] text-ink-faint">Contenido base</span>}
                  <span className="text-xs text-ink-faint">
                    {unitTopics.length} {unitTopics.length === 1 ? "subtema" : "subtemas"}
                  </span>
                </summary>

                <div className="border-t border-line px-5 pb-5">
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    {unit.description && <p className="text-sm text-ink-muted">{unit.description}</p>}
                    {canEdit && !isArchived && !isCore && (
                      <MoveButtons action={moveUnit} fields={{ courseId: course.id, unitId: unit.id }} />
                    )}
                  </div>

                  {unitTopics.length > 0 && (
                    <ul className="mt-4 divide-y divide-line border-t border-line">
                      {unitTopics.map((topic, index) => {
                        const own = topic.course_id === course.id;
                        return (
                          <li
                            key={topic.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                          >
                            <span className="min-w-0 text-ink-soft">
                              <span className="mr-2 font-mono text-xs text-ink-faint">
                                {unit.number}.{index + 1}
                              </span>
                              {topic.title}
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              {canEdit && !isArchived && contentGroup && (
                                <TopicContentLink
                                  topicId={topic.id}
                                  classId={contentGroup.id}
                                />
                              )}
                              {canEdit && !isArchived && own && (
                                <MoveButtons
                                  action={moveTopic}
                                  fields={{ courseId: course.id, topicId: topic.id }}
                                />
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canEdit && !isArchived && <CreateTopicForm courseId={course.id} unitId={unit.id} />}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
