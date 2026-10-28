import Link from "next/link";

import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { CreateCourseForm } from "./create-course-form";

type CourseRow = {
  id: string;
  key: string;
  title: string;
  is_base: boolean;
  lesson_count: number;
};

export default async function MisCursosPage() {
  const teacher = await requireTeacher();

  const courses = await db()<CourseRow[]>`
    select c.id, c.key, c.title, c.is_base,
      (select count(*)::int
         from lessons l
        where l.course_id = c.id and l.archived_at is null) as lesson_count
      from courses c
     where c.is_base or c.owner_id = ${teacher.id} or ${teacher.role} = 'admin'
     order by c.is_base desc, c.created_at`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Mis cursos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          El core es compartido. Lo que agregues se publica en tu propio curso.
        </p>
      </div>

      <CreateCourseForm />

      {courses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Todavía no hay cursos. El curso base se crea al importar el contenido del core.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/cursos/${course.id}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  {course.title}
                </Link>
                {course.is_base && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    Core
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">{course.key}</p>
              <p className="mt-4 text-sm text-zinc-500">
                {course.lesson_count}{" "}
                {course.is_base
                  ? course.lesson_count === 1
                    ? "lección del core"
                    : "lecciones del core"
                  : course.lesson_count === 1
                    ? "aportación"
                    : "aportaciones"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
