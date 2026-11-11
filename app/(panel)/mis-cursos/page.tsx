import Link from "next/link";

import { restore } from "@/lib/actions/publish";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

type CourseRow = {
  id: string;
  key: string;
  title: string;
  description: string;
  is_base: boolean;
  status: "draft" | "published" | "unpublished";
  archived_at: Date | null;
  lesson_count: number;
};

const STATUS_LABEL: Record<CourseRow["status"], string> = {
  draft: "Borrador",
  published: "Publicado",
  unpublished: "Sin publicar",
};

const STATUS_DOT: Record<CourseRow["status"], string> = {
  draft: "bg-ink-faint",
  published: "bg-positive",
  unpublished: "bg-warning",
};

export default async function MisCursosPage() {
  const teacher = await requireTeacher();

  const courses = await db()<CourseRow[]>`
    select c.id, c.key, c.title, c.description, c.is_base, c.status, c.archived_at,
      (select count(*)::int
         from lessons l
        where l.course_id = c.id and l.archived_at is null) as lesson_count
      from courses c
     where not c.is_group
       and (c.is_base or c.owner_id = ${teacher.id} or ${teacher.role} = 'admin')
     order by c.is_base desc, c.created_at`;

  const activeCourses = courses.filter((course) => !course.archived_at);
  const archivedCourses = courses.filter((course) => course.archived_at && !course.is_base);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="page-title">Mis cursos</h1>
          <p className="page-lead">
            El contenido base es compartido. Lo que agregues se publica en tu propio
            curso.
          </p>
        </div>
        <Link href="/mis-cursos/crear" className="btn btn-primary">
          Crear curso
        </Link>
      </header>

      {activeCourses.length === 0 ? (
        <div className="empty">
          <p>Todavía no hay cursos. Crea el primero para empezar a publicar.</p>
          <Link href="/mis-cursos/crear" className="btn btn-primary btn-sm mt-3">
            Crear curso
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {activeCourses.map((course) => (
            <li key={course.id} className="card card-hover flex flex-col p-5">
              <Link
                href={`/cursos/${course.id}`}
                className="text-balance text-[15px] font-semibold text-ink underline-offset-4 hover:underline"
              >
                {course.title}
              </Link>

              {course.description && (
                <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                  {course.description}
                </p>
              )}

              <p className="mt-1 font-mono text-xs text-ink-faint">{course.key}</p>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm text-ink-muted">
                <p>
                  <span className="tabular-nums text-ink-soft">{course.lesson_count}</span>{" "}
                  {course.is_base
                    ? course.lesson_count === 1
                      ? "lección de contenido base"
                      : "lecciones de contenido base"
                    : course.lesson_count === 1
                      ? "aportación"
                      : "aportaciones"}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <span
                    className={`size-1.5 rounded-full ${STATUS_DOT[course.status]}`}
                  />
                  {STATUS_LABEL[course.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {archivedCourses.length > 0 && (
        <section className="card p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Cursos archivados</h2>
            <p className="mt-1 text-sm text-ink-muted">
              No aparecen en los selectores ni para alumnos. Restaurarlos no publica una versión.
            </p>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {archivedCourses.map((course) => (
              <li key={course.id} className="rounded-xl border border-line bg-surface-soft p-4">
                <p className="text-sm font-semibold text-ink">{course.title}</p>
                {course.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{course.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-ink-faint">{course.key}</span>
                  <form action={restore}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Restaurar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
