import Link from "next/link";

import { deleteReference, setElementReferences } from "@/lib/actions/references";
import { canEditCourse, getCourseForRead } from "@/lib/access";
import { requireTeacher } from "@/lib/auth";
import type { CoreReference } from "@/lib/content/model";
import { apa7Text, referenceUrl } from "@/lib/content/references";
import { db } from "@/lib/db";

import { ReferenceForm } from "./reference-form";

type ElementRow = { content_id: string; label: string };
type LinkRow = { kind: string; element_content_id: string; reference_content_id: string };

const GROUPS = [
  { kind: "lesson", title: "Lecciones" },
  { kind: "evaluation", title: "Evaluaciones" },
  { kind: "question", title: "Preguntas" },
  { kind: "exercise", title: "Ejercicios" },
  { kind: "example", title: "Ejemplos" },
] as const;

export default async function ReferencesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireTeacher();
  const { id: courseId } = await params;
  const course = await getCourseForRead(teacher, courseId);
  const canEdit = canEditCourse(teacher, course);

  const sql = db();
  const references = await sql<(CoreReference & { id: string })[]>`
    select id, content_id, authors, year, title, source, edition, doi, url
      from content_references
     where course_id = ${course.id} and archived_at is null
     order by content_id`;
  const links = await sql<LinkRow[]>`
    select 'lesson' as kind, l.content_id as element_content_id,
           r.content_id as reference_content_id
      from lesson_references lr
      join content_references r on r.id = lr.reference_id
      join lessons l on l.id = lr.lesson_id
     where l.course_id = ${course.id} and l.archived_at is null and r.archived_at is null
    union all
    select 'evaluation', e.content_id, r.content_id
      from evaluation_references er
      join content_references r on r.id = er.reference_id
      join evaluations e on e.id = er.evaluation_id
     where e.course_id = ${course.id} and e.archived_at is null and r.archived_at is null
    union all
    select 'question', q.content_id, r.content_id
      from question_references qr
      join content_references r on r.id = qr.reference_id
      join questions q on q.id = qr.question_id
      join evaluations e on e.id = q.evaluation_id
     where q.course_id = ${course.id} and q.archived_at is null
       and e.archived_at is null and r.archived_at is null
    union all
    select 'exercise', x.content_id, r.content_id
      from exercise_references xr
      join content_references r on r.id = xr.reference_id
      join exercises x on x.id = xr.exercise_id
     where x.course_id = ${course.id} and x.archived_at is null and r.archived_at is null
    union all
    select 'example', x.content_id, r.content_id
      from example_references xr
      join content_references r on r.id = xr.reference_id
      join examples x on x.id = xr.example_id
     where x.course_id = ${course.id} and x.archived_at is null and r.archived_at is null
    order by 1, 2, 3`;

  const current = new Map<string, string[]>();
  for (const row of links) {
    const key = `${row.kind}:${row.element_content_id}`;
    current.set(key, [...(current.get(key) ?? []), row.reference_content_id]);
  }

  const elements: Record<(typeof GROUPS)[number]["kind"], ElementRow[]> = {
    lesson: await sql<ElementRow[]>`
      select content_id, code || ' · ' || title as label
        from lessons
       where course_id = ${course.id} and archived_at is null
       order by position, code, content_id`,
    evaluation: await sql<ElementRow[]>`
      select content_id, title as label
        from evaluations
       where course_id = ${course.id} and archived_at is null
       order by position, content_id`,
    question: await sql<ElementRow[]>`
      select q.content_id, q.prompt as label
        from questions q
        join evaluations e on e.id = q.evaluation_id
       where q.course_id = ${course.id} and q.archived_at is null
         and e.archived_at is null
       order by e.position, q.position, q.content_id`,
    exercise: await sql<ElementRow[]>`
      select content_id, prompt as label
        from exercises
       where course_id = ${course.id} and archived_at is null
       order by position, content_id`,
    example: await sql<ElementRow[]>`
      select content_id, title as label
        from examples
       where course_id = ${course.id} and archived_at is null
       order by position, content_id`,
  };

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/cursos/${course.id}`} className="text-sm text-ink-muted hover:text-ink">
          ← {course.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">Referencias</h1>
          <span className="badge badge-neutral">APA 7</span>
          {!canEdit && <span className="badge badge-warning">Solo lectura</span>}
        </div>
        <p className="page-lead">
          El CMS guarda los metadatos y genera el texto al publicar. Solo se publican
          las referencias adjuntas a elementos visibles del curso.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Bibliografía del curso</h2>
        {references.length === 0 ? (
          <p className="empty">Este curso todavía no tiene referencias.</p>
        ) : (
          <ul className="space-y-3">
            {references.map((reference) => (
              <li key={reference.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-faint">
                    {reference.content_id}
                  </span>
                  <span className="text-sm text-ink-soft">{apa7Text(reference)}</span>
                </div>
                {referenceUrl(reference) && (
                  <p className="mt-1 break-all font-mono text-xs text-ink-faint">
                    {referenceUrl(reference)}
                  </p>
                )}
                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <details>
                      <summary className="cursor-pointer text-sm text-ink-muted">
                        Editar
                      </summary>
                      <div className="mt-3">
                        <ReferenceForm
                          courseId={course.id}
                          reference={reference}
                        />
                      </div>
                    </details>
                    <form action={deleteReference}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="referenceId" value={reference.content_id} />
                      <button type="submit" className="btn btn-danger btn-sm">
                        Eliminar
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <details className="card p-5">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Agregar referencia
            </summary>
            <div className="mt-4">
              <ReferenceForm courseId={course.id} />
            </div>
          </details>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Adjuntar a elementos</h2>
        {references.length === 0 ? (
          <p className="empty">Agrega una referencia para poder adjuntarla.</p>
        ) : (
          GROUPS.map((group) => (
            <div key={group.kind} className="card p-5">
              <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
              {elements[group.kind].length === 0 ? (
                <p className="empty mt-3">Todavía no hay {group.title.toLowerCase()}.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {elements[group.kind].map((element) => {
                    const selected = current.get(`${group.kind}:${element.content_id}`) ?? [];
                    return (
                      <li key={element.content_id} className="py-3 text-sm">
                        <details>
                          <summary className="cursor-pointer text-ink-soft">
                            {element.label}
                            <span className="ml-2 text-xs text-ink-faint">
                              {selected.length} {selected.length === 1 ? "referencia" : "referencias"}
                            </span>
                          </summary>
                          {canEdit ? (
                            <form action={setElementReferences} className="mt-3 space-y-2">
                              <input type="hidden" name="courseId" value={course.id} />
                              <input type="hidden" name="kind" value={group.kind} />
                              <input
                                type="hidden"
                                name="elementContentId"
                                value={element.content_id}
                              />
                              {references.map((reference) => (
                                <label
                                  key={reference.id}
                                  className="flex items-start gap-2 text-sm text-ink-soft"
                                >
                                  <input
                                    type="checkbox"
                                    name="referenceIds"
                                    value={reference.content_id}
                                    defaultChecked={selected.includes(reference.content_id)}
                                    className="mt-1"
                                  />
                                  <span>
                                    <span className="font-mono text-xs text-ink-faint">
                                      {reference.content_id}
                                    </span>{" "}
                                    {reference.title}
                                  </span>
                                </label>
                              ))}
                              <button type="submit" className="btn btn-secondary btn-sm">
                                Guardar asociaciones
                              </button>
                            </form>
                          ) : (
                            <ul className="mt-3 space-y-1 text-sm text-ink-muted">
                              {selected.length === 0 ? (
                                <li>Sin referencias.</li>
                              ) : (
                                references
                                  .filter((reference) =>
                                    selected.includes(reference.content_id),
                                  )
                                  .map((reference) => (
                                    <li key={reference.id}>{apa7Text(reference)}</li>
                                  ))
                              )}
                            </ul>
                          )}
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
