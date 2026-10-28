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
      <div>
        <Link href="/mis-cursos" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Mis cursos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">{course.title}</h1>
          <span className="font-mono text-xs text-zinc-500">{course.key}</span>
          {course.is_base && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              Core
            </span>
          )}
          {!canEdit && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              Solo lectura
            </span>
          )}
          {canEdit && (
            <Link
              href={`/cursos/${course.id}/publicar`}
              className="ml-auto rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Publicar
            </Link>
          )}
        </div>
      </div>

      {units.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Este curso todavía no tiene unidades.
        </p>
      ) : (
        <div className="space-y-4">
          {units.map((unit) => {
            const unitLessons = lessons.filter((lesson) => lesson.unit_id === unit.id);
            const isCore = unit.course_id !== course.id;

            return (
              <section
                key={unit.id}
                className="rounded-xl border border-zinc-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-medium text-zinc-900">
                    {unit.number}. {unit.title}
                  </h2>
                  <span className="text-xs text-zinc-500">
                    {unit.difficulty} · {unit.color}
                  </span>
                  {isCore && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      Core
                    </span>
                  )}
                </div>

                {unit.description && (
                  <p className="mt-1 text-sm text-zinc-500">{unit.description}</p>
                )}

                {unitLessons.length > 0 && (
                  <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
                    {unitLessons.map((lesson) => {
                      const own = lesson.course_id === course.id;

                      return (
                        <li
                          key={lesson.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                        >
                          <span className="text-zinc-700">
                            <span className="mr-2 font-mono text-xs text-zinc-400">
                              {lesson.code}
                            </span>
                            {lesson.title}
                          </span>

                          {own && canEdit ? (
                            <Link
                              href={`/cursos/${course.id}/lecciones/${lesson.id}`}
                              className="text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                            >
                              Editar
                            </Link>
                          ) : (
                            <span className="text-xs text-zinc-400">Core</span>
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
