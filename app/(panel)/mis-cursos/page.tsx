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
     where not c.is_group
       and (c.is_base or c.owner_id = ${teacher.id} or ${teacher.role} = 'admin')
     order by c.is_base desc, c.created_at`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Mis cursos</h1>
        <p className="page-lead">
          El core es compartido. Lo que agregues se publica en tu propio curso.
        </p>
      </header>

      <CreateCourseForm />

      {courses.length === 0 ? (
        <p className="empty">
          Todavía no hay cursos. El curso base se crea al importar el contenido del core.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id} className="card card-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/cursos/${course.id}`}
                  className="text-[15px] font-medium text-ink underline-offset-4 hover:underline"
                >
                  {course.title}
                </Link>
                {course.is_base && <span className="badge badge-neutral">Core</span>}
              </div>

              <p className="mt-1 font-mono text-xs text-ink-faint">{course.key}</p>

              <p className="mt-auto border-t border-line pt-3 text-sm text-ink-muted">
                <span className="font-mono text-ink-soft">{course.lesson_count}</span>{" "}
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
