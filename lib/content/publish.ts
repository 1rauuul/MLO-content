import type { Course } from "@/lib/access";
import type { Teacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { buildManifest, composeCatalog } from "./compose";
import { validateCatalogForPublish } from "./validate";
import type {
  CoreCourse,
  CoreEvaluation,
  CoreExample,
  CoreExercise,
  CoreLesson,
  CoreQuestion,
  CoreUnit,
} from "./model";

export type PublishOutcome = {
  version: number;
  hash: string;
  lessons: number;
};

/**
 * Lee el contenido vigente (core + adiciones del dueño), compone el catálogo
 * y guarda un snapshot inmutable. La fila del curso se bloquea para que dos
 * publicaciones simultáneas no repitan versión.
 */
export async function publishCourse(teacher: Teacher, course: Course): Promise<PublishOutcome> {
  return db().begin(async (tx) => {
    const [current] = await tx<{ key: string; title: string }[]>`
      select key, title from courses where id = ${course.id} for update`;
    if (!current) throw new Error("El curso no existe.");

    const [base] = await tx<{ id: string }[]>`
      select id from courses where is_base limit 1`;
    const sourceIds = base && base.id !== course.id ? [base.id, course.id] : [course.id];

    const units = await tx<CoreUnit[]>`
      select content_id, number, title, description, difficulty, color, position
        from units
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by number, position`;
    const lessons = await tx<CoreLesson[]>`
      select content_id, unit_id as unit_content_id, code, title, eyebrow, body,
             code_sample, context_title, context_body, synthesis, content, position
        from lessons
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by position, code`;
    const evaluations = await tx<CoreEvaluation[]>`
      select content_id, lesson_id as lesson_content_id, title, description,
             question_count, exercise_count
        from evaluations
       where course_id in ${tx(sourceIds)} and archived_at is null`;
    const exercises = await tx<CoreExercise[]>`
      select content_id, lesson_id as lesson_content_id, type, prompt, instructions,
             correct_order, config, explanation, example, position
        from exercises
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by position, content_id`;
    const examples = await tx<CoreExample[]>`
      select content_id, lesson_id as lesson_content_id, type, title, prompt,
             config, steps, hints, explanation, position
        from examples
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by position, content_id`;
    // La pregunta se liga a la evaluación por la lección (una por lección).
    const questions = await tx<CoreQuestion[]>`
      select q.content_id, e.content_id as evaluation_content_id, q.type, q.prompt,
             q.options, q.answer, q.config, q.explanation, q.position
        from questions q
        join evaluations e on e.lesson_id = q.lesson_id
       where q.course_id in ${tx(sourceIds)}
         and q.archived_at is null
         and e.archived_at is null
       order by q.position, q.content_id`;

    // Las columnas de referencia guardan UUID; la composición usa content_id.
    const unitKeyById = new Map(
      (
        await tx<{ id: string; content_id: string }[]>`
          select id, content_id from units
           where course_id in ${tx(sourceIds)}`
      ).map((row) => [row.id, row.content_id]),
    );
    const lessonKeyById = new Map(
      (
        await tx<{ id: string; content_id: string }[]>`
          select id, content_id from lessons
           where course_id in ${tx(sourceIds)}`
      ).map((row) => [row.id, row.content_id]),
    );
    const source: CoreCourse = {
      schemaVersion: 2,
      title: current.title,
      units,
      lessons: lessons.map((row) => ({
        ...row,
        unit_content_id: unitKeyById.get(row.unit_content_id) ?? row.unit_content_id,
      })),
      evaluations: evaluations.map((row) => ({
        ...row,
        lesson_content_id:
          lessonKeyById.get(row.lesson_content_id) ?? row.lesson_content_id,
      })),
      exercises: exercises.map((row) => ({
        ...row,
        lesson_content_id: lessonKeyById.get(row.lesson_content_id) ?? row.lesson_content_id,
      })),
      examples: examples.map((row) => ({
        ...row,
        lesson_content_id: lessonKeyById.get(row.lesson_content_id) ?? row.lesson_content_id,
      })),
      questions,
    };

    validateCatalogForPublish(source);
    const catalog = composeCatalog(current.key, source);
    const [next] = await tx<{ version: number }[]>`
      select coalesce(max(version), 0) + 1 as version
        from releases
       where course_id = ${course.id}`;
    const version = next.version;
    const publishedAt = new Date().toISOString();
    const manifest = buildManifest(catalog, version, publishedAt);
    const snapshot = {
      manifest,
      lessons: Object.fromEntries(catalog.lessons.map((lesson) => [lesson.lessonId, lesson])),
    };

    await tx`insert into releases
        (course_id, version, schema_version, content_hash, published_at, published_by, snapshot)
      values
        (${course.id}, ${version}, 2, ${manifest.hash}, ${publishedAt}, ${teacher.id},
         ${tx.json(snapshot as never)})`;

    return { version, hash: manifest.hash, lessons: catalog.lessons.length };
  });
}
