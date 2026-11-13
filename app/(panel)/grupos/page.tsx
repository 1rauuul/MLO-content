import Link from "next/link";

import { requireTeacher } from "@/lib/auth";
import { listClasses } from "@/lib/classes";
import { db } from "@/lib/db";

import { CreateClassForm } from "./create-class-form";

export default async function GruposPage() {
  const teacher = await requireTeacher();
  const [classes, courses] = await Promise.all([
    listClasses(teacher),
    db()<{ id: string; title: string }[]>`
      select id, title
        from courses
       where not is_group
         and archived_at is null
         and (is_base or owner_id = ${teacher.id} or ${teacher.role} = 'admin')
       order by is_base desc, title`,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Mis grupos</h1>
        <p className="page-lead">
          Cada grupo tiene un código fijo para que los alumnos se unan. El contenido que
          crees se publica por grupo.
        </p>
      </header>

      <CreateClassForm courses={courses} />

      {classes.length === 0 ? (
        <p className="empty">
          Todavía no tienes grupos. Crea el primero para generar su código.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((klass) => (
            <li key={klass.id} className="card card-hover p-3.5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/grupos/${klass.id}`}
                  className="min-w-0 truncate text-[15px] font-semibold text-ink underline-offset-4 hover:underline"
                >
                  {klass.name}
                </Link>
                <span className="shrink-0 rounded-md bg-surface-soft px-1.5 py-0.5 font-mono text-xs tracking-widest text-ink-soft ring-1 ring-line">
                  {klass.join_code}
                </span>
              </div>

              <p className="mt-1 truncate text-xs text-ink-muted">
                Curso: <span className="text-ink-soft">{klass.course_title}</span>
                {teacher.role === "admin" && (
                  <> · Docente: {klass.teacher_name}</>
                )}
              </p>

              <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs text-ink-muted">
                <span>
                  <span className="font-medium tabular-nums text-ink">
                    {klass.student_count}
                  </span>{" "}
                  {klass.student_count === 1 ? "alumno" : "alumnos"}
                </span>
                <span>
                  <span className="font-medium tabular-nums text-ink">
                    {klass.extra_count}
                  </span>{" "}
                  {klass.extra_count === 1 ? "adicional" : "adicionales"}
                </span>
                <span className="ml-auto">
                  {klass.published_version ? (
                    <span className="inline-flex items-center gap-1.5 text-ink-soft">
                      <span className="size-1.5 rounded-full bg-positive" />
                      <span className="tabular-nums">v{klass.published_version}</span>
                    </span>
                  ) : (
                    <span className="text-ink-faint">Sin publicar</span>
                  )}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
