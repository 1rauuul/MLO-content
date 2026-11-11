import { redirect } from "next/navigation";

import { BackLink } from "@/app/(panel)/back-link";
import { archive } from "@/lib/actions/publish";
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
  if (course.archived_at) redirect("/mis-cursos");

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
      <header>
        <BackLink href={`/cursos/${course.id}`}>{course.title}</BackLink>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">Guardar curso</h1>
          <span className="font-mono text-xs text-ink-faint">{course.key}</span>
          <span className="badge badge-neutral">{course.level}</span>
          <span
            className={
              course.status === "published"
                ? "badge badge-positive"
                : course.status === "unpublished"
                  ? "badge badge-warning"
                  : "badge badge-neutral"
            }
          >
            {course.status === "published"
              ? "Publicado"
              : course.status === "unpublished"
                ? "Sin publicar"
                : "Borrador"}
          </span>
          {!course.is_base && (
            <span className="text-xs text-ink-muted">
              {course.uses_base ? "Con contenido base" : "Sin contenido base"}
            </span>
          )}
          {!course.is_base && (
            <form action={archive} className="ml-auto">
              <input type="hidden" name="courseId" value={course.id} />
              <button type="submit" className="btn btn-secondary btn-sm">
                Archivar
              </button>
            </form>
          )}
        </div>
        <p className="page-lead">
          Cada guardado publica un snapshot inmutable con el contenido base y tus
          adiciones.
        </p>
      </header>

      <div className="card p-5 text-sm text-ink-muted">
        {last ? (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Última versión</dt>
              <dd className="mt-0.5 text-base font-medium tabular-nums text-ink">
                {last.version}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Lecciones</dt>
              <dd className="mt-0.5 text-base font-medium tabular-nums text-ink">
                {last.lessons}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Publicada</dt>
              <dd className="mt-0.5 text-base font-medium tabular-nums text-ink">
                {new Date(last.published_at).toISOString().slice(0, 16).replace("T", " ")}
              </dd>
            </div>
          </dl>
        ) : (
          <p>Este curso todavía no tiene ninguna versión publicada.</p>
        )}

        <p className="mt-4 border-t border-line pt-4 text-xs text-ink-faint">
          Los ids se prefijan con la clave del curso; el contenido base conserva los
          suyos.
        </p>
      </div>

      <div className="card p-5">
        <PublishForm courseId={course.id} />
      </div>
    </div>
  );
}
