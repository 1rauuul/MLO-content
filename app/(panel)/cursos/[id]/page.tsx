import Link from "next/link";

import { canEditCourse, getBaseCourseId, getCourseForRead } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { CreateLessonForm } from "./lesson-form";
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

type LessonRow = {
  id: string;
  course_id: string;
  unit_id: string;
  code: string;
  title: string;
};

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;

  const course = await getCourseForRead(teacher, id);
  const canEdit = canEditCourse(teacher, course);
  const coreId = (await getBaseCourseId()) ?? course.id;

  const units = await db()<UnitRow[]>`
    select id, course_id, number, title, description, difficulty, color
      from units
     where course_id in (${course.id}, ${coreId})
       and archived_at is null
     order by number, position`;

  const lessons = await db()<LessonRow[]>`
    select id, course_id, unit_id, code, title
      from lessons
     where course_id in (${course.id}, ${coreId})
       and archived_at is null
     order by position, code`;

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
          {!canEdit && <span className="badge badge-warning">Solo lectura</span>}
          {canEdit && (
            <Link href={`/cursos/${course.id}/publicar`} className="btn btn-primary btn-sm ml-auto">
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
            const unitLessons = lessons.filter((lesson) => lesson.unit_id === unit.id);
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
                </div>

                {unit.description && (
                  <p className="mt-2 text-sm text-ink-muted">{unit.description}</p>
                )}

                {unitLessons.length > 0 && (
                  <ul className="mt-4 divide-y divide-line border-t border-line">
                    {unitLessons.map((lesson) => {
                      const own = lesson.course_id === course.id;

                      return (
                        <li
                          key={lesson.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                        >
                          <span className="text-ink-soft">
                            <span className="mr-2 font-mono text-xs text-ink-faint">
                              {lesson.code}
                            </span>
                            {lesson.title}
                          </span>

                          {own && canEdit ? (
                            <Link
                              href={`/cursos/${course.id}/lecciones/${lesson.id}`}
                              className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                            >
                              Editar
                            </Link>
                          ) : (
                            <span className="text-xs text-ink-faint">Core</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canEdit && <CreateLessonForm courseId={course.id} unitId={unit.id} />}
              </section>
            );
          })}
        </div>
      )}

      {canEdit && <CreateUnitForm courseId={course.id} />}
    </div>
  );
}
