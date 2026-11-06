import type { Course } from "@/lib/access";
import type { Teacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { buildManifest, composeCatalog } from "./compose";
import { validateRelease } from "./contract-v3";
import { validateCatalogForPublish } from "./validate";
import { buildEmptyV3Release, nextReleaseVersion, resolveBaseRef, sourceCourseIds } from "./v3";
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
    const [current] = await tx<
      { key: string; title: string; uses_base: boolean; is_base: boolean }[]
    >`select key, title, uses_base, is_base from courses where id = ${course.id} for update`;
    if (!current) throw new Error("El curso no existe.");

    const usesBase = current.uses_base && !current.is_base;

    let latestBase: { version: number; hash: string } | null = null;
    if (usesBase) {
      const [row] = await tx<{ version: number; content_hash: string }[]>`
        select r.version, r.content_hash
          from releases r
          join courses c on c.id = r.course_id
         where c.is_base
         order by r.version desc
         limit 1`;
      latestBase = row ? { version: row.version, hash: row.content_hash } : null;
    }
    const baseRef = resolveBaseRef(usesBase, latestBase);

    const [base] = await tx<{ id: string }[]>`
      select id from courses where is_base limit 1`;
    const sourceIds = sourceCourseIds(usesBase, base?.id ?? null, course.id);

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

    // Una sola secuencia de versiones para v2 y v3; así el release v3 puede
    // nacer vacío y el siguiente release v2 no colisiona.
    const [v2Latest] = await tx<{ version: number }[]>`
      select coalesce(max(version), 0) as version
        from releases
       where course_id = ${course.id}`;
    const [v3Latest] = await tx<{ version: number }[]>`
      select coalesce(max(version), 0) as version
        from releases_v3
       where course_id = ${course.id}`;
    const version = nextReleaseVersion(v2Latest.version, v3Latest.version);
    const publishedAt = new Date().toISOString();

    // v2 se mantiene intacto: solo se crea cuando hay lecciones publicables.
    let v2Hash: string | null = null;
    if (lessons.length > 0) {
      validateCatalogForPublish(source);
      const catalog = composeCatalog(current.key, source);
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
      v2Hash = manifest.hash;
    }

    const release = buildEmptyV3Release({
      catalogId: current.key,
      courseId: course.id,
      version,
      publishedAt,
      title: current.title,
      baseRef,
    });
    const checked = validateRelease(release);
    if (!checked.ok) {
      throw new Error(`El release v3 no es válido: ${checked.error}`);
    }

    await tx`insert into releases_v3
        (course_id, version, content_hash, published_at, published_by, snapshot)
      values
        (${course.id}, ${version}, ${release.hash}, ${publishedAt}, ${teacher.id},
         ${tx.json({ release } as never)})`;

    await tx`update courses set status = 'published' where id = ${course.id}`;

    return { version, hash: v2Hash ?? release.hash, lessons: lessons.length };
  });
}

/** Despublica sin borrar releases ni tocar v2. */
export async function unpublishCourse(courseId: string): Promise<void> {
  await db()`update courses set status = 'unpublished' where id = ${courseId}`;
}
