import Link from "next/link";

import { requireTeacher } from "@/lib/auth";
import { listClasses } from "@/lib/classes";
import { db } from "@/lib/db";

import { CreateClassForm } from "./create-class-form";

export default async function ClasesPage() {
  const teacher = await requireTeacher();
  const classes = await listClasses(teacher);
  const parentCourses = await db()<{ id: string; title: string }[]>`
    select id, title from courses
     where not is_group
       and (is_base or owner_id = ${teacher.id} or ${teacher.role} = 'admin')
     order by is_base desc, title`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Clases</h1>
        <p className="page-lead">
          Cada clase tiene un código fijo para que los alumnos se unan. El contenido extra
          que asignes se publica por clase.
        </p>
      </header>

      <CreateClassForm courses={parentCourses} />

      {classes.length === 0 ? (
        <p className="empty">
          Todavía no tienes clases. Crea la primera para generar su código.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {classes.map((klass) => (
            <li key={klass.id} className="card card-hover flex flex-col p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/clases/${klass.id}`}
                  className="text-[15px] font-medium text-ink underline-offset-4 hover:underline"
                >
                  {klass.name}
                </Link>
                <span className="rounded-lg bg-surface-soft px-2 py-1 font-mono text-sm tracking-widest text-ink-soft ring-1 ring-line">
                  {klass.join_code}
                </span>
              </div>

              {teacher.role === "admin" && (
                <p className="mt-1 text-xs text-ink-faint">Docente: {klass.teacher_name}</p>
              )}

              <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
                <div>
                  <dt className="eyebrow">Alumnos</dt>
                  <dd className="mt-0.5 font-medium text-ink">{klass.student_count}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Extras</dt>
                  <dd className="mt-0.5 font-medium text-ink">{klass.extra_count}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Publicado</dt>
                  <dd className="mt-0.5">
                    {klass.published_version ? (
                      <span className="badge badge-positive">v{klass.published_version}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
