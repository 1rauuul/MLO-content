import type { Course } from "@/lib/access";
import type { Teacher } from "@/lib/auth";
import { db } from "@/lib/db";

import { buildManifest, composeCatalog } from "./compose";
import { validateRelease } from "./contract-v3";
import { validateCatalogForPublish } from "./validate";
import { buildV3Release, nextReleaseVersion, resolveBaseRef, sourceCourseIds, assertPublishableCourse } from "./v3";
import { selectPrimaryEvaluations } from "./x03";
import type {
  CoreCourse,
  CoreEvaluation,
  CoreExample,
  CoreExercise,
  CoreLesson,
  CoreQuestion,
  CoreTopic,
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
      { key: string; title: string; uses_base: boolean; is_base: boolean; is_group: boolean }[]
    >`select key, title, uses_base, is_base, is_group from courses where id = ${course.id} for update`;
    if (!current) throw new Error("El curso no existe.");
    assertPublishableCourse(current);

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
    const topics = await tx<(CoreTopic & { unit_id: string })[]>`
      select content_id, unit_id, title, summary, position
        from topics
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by position, content_id`;
    const lessons = await tx<(CoreLesson & { topic_id: string })[]>`
      select content_id, unit_id as unit_content_id, topic_id, code, title, eyebrow, body,
             code_sample, context_title, context_body, synthesis, content, position
        from lessons
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by position, code`;
    const evaluations = await tx<(CoreEvaluation & { topic_id: string })[]>`
      select content_id, lesson_id as lesson_content_id, topic_id, title, description,
             question_count, exercise_count, position
        from evaluations
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by lesson_id, position, content_id`;
    const exercises = await tx<(CoreExercise & { topic_id: string })[]>`
      select content_id, lesson_id as lesson_content_id, topic_id, type, prompt, instructions,
             correct_order, config, explanation, example, position
        from exercises
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by position, content_id`;
    const examples = await tx<(CoreExample & { topic_id: string })[]>`
      select content_id, lesson_id as lesson_content_id, topic_id, type, title, prompt,
             config, steps, hints, explanation, position
        from examples
       where course_id in ${tx(sourceIds)} and archived_at is null
       order by position, content_id`;
    const questions = await tx<CoreQuestion[]>`
      select q.content_id, e.content_id as evaluation_content_id, q.type, q.prompt,
             q.options, q.answer, q.config, q.explanation, q.position
        from questions q
        join evaluations e on e.id = q.evaluation_id
       where q.course_id in ${tx(sourceIds)}
         and q.archived_at is null
         and e.archived_at is null
       order by e.content_id, q.position, q.content_id`;
    const evaluationExercises = await tx<
      { evaluation_content_id: string; exercise_content_id: string }[]
    >`
      select e.content_id as evaluation_content_id, x.content_id as exercise_content_id
        from evaluation_exercises ee
        join evaluations e on e.id = ee.evaluation_id
        join exercises x on x.id = ee.exercise_id
       where e.course_id in ${tx(sourceIds)}
         and e.archived_at is null
         and x.archived_at is null
       order by e.content_id, x.position, x.content_id`;

    // Las columnas de referencia guardan UUID; la composición usa content_id.
    const unitKeyById = new Map(
      (
        await tx<{ id: string; content_id: string }[]>`
          select id, content_id from units
           where course_id in ${tx(sourceIds)}`
      ).map((row) => [row.id, row.content_id]),
    );
    const topicKeyById = new Map(
      (
        await tx<{ id: string; content_id: string }[]>`
          select id, content_id from topics
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
    const exercisesByEvaluation = new Map<string, string[]>();
    for (const row of evaluationExercises) {
      const list = exercisesByEvaluation.get(row.evaluation_content_id) ?? [];
      list.push(row.exercise_content_id);
      exercisesByEvaluation.set(row.evaluation_content_id, list);
    }

    const mappedTopics: CoreTopic[] = topics.map((topic) => ({
      content_id: topic.content_id,
      unit_content_id: unitKeyById.get(topic.unit_id) ?? topic.unit_id,
      title: topic.title,
      summary: topic.summary,
      position: topic.position,
    }));
    const mappedLessons: CoreLesson[] = lessons.map((lesson) => ({
      content_id: lesson.content_id,
      unit_content_id:
        unitKeyById.get(lesson.unit_content_id) ?? lesson.unit_content_id,
      topic_content_id: topicKeyById.get(lesson.topic_id) ?? lesson.topic_id,
      code: lesson.code,
      title: lesson.title,
      eyebrow: lesson.eyebrow,
      body: lesson.body,
      code_sample: lesson.code_sample,
      context_title: lesson.context_title,
      context_body: lesson.context_body,
      synthesis: lesson.synthesis,
      content: lesson.content,
      position: lesson.position,
    }));
    const mappedEvaluations: CoreEvaluation[] = evaluations.map((evaluation) => ({
      content_id: evaluation.content_id,
      lesson_content_id:
        lessonKeyById.get(evaluation.lesson_content_id) ?? evaluation.lesson_content_id,
      topic_content_id: topicKeyById.get(evaluation.topic_id) ?? evaluation.topic_id,
      title: evaluation.title,
      description: evaluation.description,
      question_count: evaluation.question_count,
      exercise_count: evaluation.exercise_count,
      position: evaluation.position ?? 0,
      exercise_content_ids: exercisesByEvaluation.get(evaluation.content_id) ?? [],
    }));
    const mappedExercises: CoreExercise[] = exercises.map((exercise) => ({
      content_id: exercise.content_id,
      lesson_content_id:
        lessonKeyById.get(exercise.lesson_content_id) ?? exercise.lesson_content_id,
      topic_content_id: topicKeyById.get(exercise.topic_id) ?? exercise.topic_id,
      type: exercise.type,
      prompt: exercise.prompt,
      instructions: exercise.instructions,
      correct_order: exercise.correct_order,
      config: exercise.config,
      explanation: exercise.explanation,
      example: exercise.example,
      position: exercise.position,
    }));
    const mappedExamples: CoreExample[] = examples.map((example) => ({
      content_id: example.content_id,
      lesson_content_id:
        lessonKeyById.get(example.lesson_content_id) ?? example.lesson_content_id,
      topic_content_id: topicKeyById.get(example.topic_id) ?? example.topic_id,
      type: example.type,
      title: example.title,
      prompt: example.prompt,
      config: example.config,
      steps: example.steps,
      hints: example.hints,
      explanation: example.explanation,
      position: example.position,
    }));

    // v2 mantiene una evaluación primaria por lección (menor position, luego id).
    const v2Evaluations = selectPrimaryEvaluations(mappedEvaluations);
    const v2EvaluationIds = new Set(v2Evaluations.map((evaluation) => evaluation.content_id));

    const source: CoreCourse = {
      schemaVersion: 2,
      title: current.title,
      units,
      topics: mappedTopics,
      lessons: mappedLessons,
      evaluations: v2Evaluations,
      exercises: mappedExercises,
      examples: mappedExamples,
      questions: questions.filter((question) =>
        v2EvaluationIds.has(question.evaluation_content_id),
      ),
    };
    const v3Source: CoreCourse = {
      ...source,
      evaluations: mappedEvaluations,
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

    const release = buildV3Release({
      catalogId: current.key,
      courseId: course.id,
      version,
      publishedAt,
      title: current.title,
      description: "",
      baseRef,
      course: v3Source,
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
