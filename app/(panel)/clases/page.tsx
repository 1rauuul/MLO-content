import Link from "next/link";

import { requireTeacher } from "@/lib/auth";
import { listClasses } from "@/lib/classes";

import { CreateClassForm } from "./create-class-form";

export default async function ClasesPage() {
  const teacher = await requireTeacher();
  const classes = await listClasses(teacher);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Clases</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cada clase tiene un código fijo para que los alumnos se unan. El contenido extra
          que asignes se publica por clase.
        </p>
      </div>

      <CreateClassForm />

      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Todavía no tienes clases. Crea la primera para generar su código.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {classes.map((klass) => (
            <li key={klass.id} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={`/clases/${klass.id}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  {klass.name}
                </Link>
                <span className="rounded-lg bg-zinc-100 px-2 py-1 font-mono text-sm tracking-widest text-zinc-800">
                  {klass.join_code}
                </span>
              </div>

              {teacher.role === "admin" && (
                <p className="mt-1 text-xs text-zinc-500">Docente: {klass.teacher_name}</p>
              )}

              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Alumnos</dt>
                  <dd className="font-medium text-zinc-900">{klass.student_count}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Extras</dt>
                  <dd className="font-medium text-zinc-900">{klass.extra_count}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-400">Publicado</dt>
                  <dd className="font-medium text-zinc-900">
                    {klass.published_version ? `v${klass.published_version}` : "—"}
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
