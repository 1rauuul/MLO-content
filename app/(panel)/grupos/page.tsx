import Link from "next/link";

import { requireTeacher } from "@/lib/auth";
import { listClasses } from "@/lib/classes";

import { CreateClassForm } from "./create-class-form";

export default async function GruposPage() {
  const teacher = await requireTeacher();
  const classes = await listClasses(teacher);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Mis grupos</h1>
        <p className="page-lead">
          Cada grupo tiene un código fijo para que los alumnos se unan. El contenido que
          crees se publica por grupo.
        </p>
      </header>

      <CreateClassForm />

      {classes.length === 0 ? (
        <p className="empty">
          Todavía no tienes grupos. Crea el primero para generar su código.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {classes.map((klass) => (
            <li key={klass.id} className="card card-hover flex flex-col p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/grupos/${klass.id}`}
                  className="text-balance text-[15px] font-semibold text-ink underline-offset-4 hover:underline"
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
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">
                    {klass.student_count}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Contenido adicional</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">
                    {klass.extra_count}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Publicado</dt>
                  <dd className="mt-0.5">
                    {klass.published_version ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-soft">
                        <span className="size-1.5 rounded-full bg-positive" />
                        <span className="tabular-nums">v{klass.published_version}</span>
                      </span>
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
