import Link from "next/link";

import { requireEditableCourse } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { PublishForm } from "./publish-form";

type ReleaseRow = {
  version: number;
  published_at: Date;
  content_hash: string;
  lessons: number;
};

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const course = await requireEditableCourse(teacher, id);

  const rows = await db()<ReleaseRow[]>`
    select version,
           published_at,
           content_hash,
           coalesce(jsonb_array_length(snapshot -> 'manifest' -> 'lessons'), 0) as lessons
      from releases
     where course_id = ${id}
     order by version desc
     limit 1`;
  const last = rows[0];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/cursos/${course.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← {course.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">Publicar</h1>
          <span className="font-mono text-xs text-zinc-500">{course.key}</span>
          {course.is_base && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              Core
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        {last ? (
          <dl className="grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">Última versión</dt>
              <dd className="font-medium text-zinc-900">{last.version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">Lecciones</dt>
              <dd className="font-medium text-zinc-900">{last.lessons}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">Publicada</dt>
              <dd className="font-medium text-zinc-900">
                {new Date(last.published_at).toISOString().slice(0, 16).replace("T", " ")}
              </dd>
            </div>
          </dl>
        ) : (
          <p>Este curso todavía no tiene ninguna versión publicada.</p>
        )}

        <p className="mt-4 text-xs text-zinc-400">
          Cada publicación guarda un snapshot inmutable con core + adiciones. Los ids se
          prefijan con la clave del curso; el core conserva los suyos.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <PublishForm courseId={course.id} />
      </div>
    </div>
  );
}
