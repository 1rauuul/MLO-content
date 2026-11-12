/**
 * Importa el contenido base exportado por MLO (`scripts/export-base.ts`).
 * Es idempotente: reemplaza el contenido del curso `base`, conserva los
 * snapshots previos y publica una versión nueva para los cursos dependientes.
 *
 *   npm run import:base [ruta]
 */
import { readFileSync } from "node:fs";

import type { Course } from "../lib/access";
import type { Teacher } from "../lib/auth";
import { db } from "../lib/db";
import type { CoreCourse } from "../lib/content/model";
import { publishCourse } from "../lib/content/publish";

function required(map: Map<string, string>, key: string, label: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Falta ${label}: ${key}`);
  return value;
}

function unique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} repetido: ${value}`);
    seen.add(value);
  }
}

function validate(data: CoreCourse): void {
  unique(data.units.map((unit) => unit.content_id), "Unidad");
  unique(data.lessons.map((lesson) => lesson.content_id), "Lección");
  unique(data.evaluations.map((evaluation) => evaluation.content_id), "Evaluación");
  unique(data.exercises.map((exercise) => exercise.content_id), "Ejercicio");
  unique(data.examples.map((example) => example.content_id), "Ejemplo");
  unique(data.questions.map((question) => question.content_id), "Pregunta");

  const units = new Set(data.units.map((unit) => unit.content_id));
  const lessons = new Set(data.lessons.map((lesson) => lesson.content_id));
  for (const lesson of data.lessons) {
    if (!units.has(lesson.unit_content_id)) {
      throw new Error(`La lección ${lesson.content_id} apunta a una unidad inexistente.`);
    }
  }
  for (const evaluation of data.evaluations) {
    if (!lessons.has(evaluation.lesson_content_id)) {
      throw new Error(`La evaluación ${evaluation.content_id} apunta a una lección inexistente.`);
    }
    if (!data.questions.some((question) => question.evaluation_content_id === evaluation.content_id)) {
      throw new Error(`La evaluación ${evaluation.content_id} no tiene preguntas.`);
    }
  }
  for (const exercise of data.exercises) {
    if (!lessons.has(exercise.lesson_content_id)) {
      throw new Error(`El ejercicio ${exercise.content_id} apunta a una lección inexistente.`);
    }
  }
  for (const example of data.examples) {
    if (!lessons.has(example.lesson_content_id)) {
      throw new Error(`El ejemplo ${example.content_id} apunta a una lección inexistente.`);
    }
  }
  const evaluations = new Set(data.evaluations.map((evaluation) => evaluation.content_id));
  for (const question of data.questions) {
    if (!evaluations.has(question.evaluation_content_id)) {
      throw new Error(`La pregunta ${question.content_id} apunta a una evaluación inexistente.`);
    }
  }
}

async function main() {
  const file = process.argv[2] ?? "scripts/fixtures/base-course.json";
  const data = JSON.parse(readFileSync(file, "utf8")) as CoreCourse;
  if (data.schemaVersion !== 2) throw new Error("schemaVersion distinta de 2.");
  validate(data);

  const sql = db();
  await sql.begin(async (tx) => {
    const [course] = await tx<{ id: string }[]>`
      insert into courses (key, title, is_base, uses_base, status)
      values ('base', ${data.title}, true, false, 'published')
      on conflict (key) do update
        set title = excluded.title,
            uses_base = false,
            status = 'published'
      returning id`;

    // units → lessons es restrict, así que se borra de hijos a padres.
    // Los releases no se tocan: son snapshots inmutables.
    await tx`delete from questions where course_id = ${course.id}`;
    await tx`delete from examples where course_id = ${course.id}`;
    await tx`delete from exercises where course_id = ${course.id}`;
    await tx`delete from evaluations where course_id = ${course.id}`;
    await tx`delete from lessons where course_id = ${course.id}`;
    await tx`delete from topics where course_id = ${course.id}`;
    await tx`delete from units where course_id = ${course.id}`;

    const unitIds = new Map<string, string>();
    for (const unit of data.units) {
      const [row] = await tx<{ id: string }[]>`
        insert into units
          (course_id, content_id, number, title, description, difficulty, color, position)
        values
          (${course.id}, ${unit.content_id}, ${unit.number}, ${unit.title},
           ${unit.description}, ${unit.difficulty}, ${unit.color}, ${unit.position})
        returning id`;
      unitIds.set(unit.content_id, row.id);
    }

    const lessonIds = new Map<string, string>();
    const topicIds = new Map<string, string>();
    for (const lesson of data.lessons) {
      const unitId = required(unitIds, lesson.unit_content_id, "unidad");
      const [topic] = await tx<{ id: string }[]>`
        insert into topics (course_id, unit_id, content_id, title, summary, position)
        values
          (${course.id}, ${unitId}, ${`t-${lesson.content_id}`}, ${lesson.title}, '',
           ${lesson.position})
        returning id`;
      topicIds.set(lesson.content_id, topic.id);

      const [row] = await tx<{ id: string }[]>`
        insert into lessons
          (course_id, unit_id, topic_id, content_id, code, title, eyebrow, body, code_sample,
           context_title, context_body, synthesis, content, position)
        values
          (${course.id}, ${unitId}, ${topic.id},
           ${lesson.content_id}, ${lesson.code}, ${lesson.title}, ${lesson.eyebrow},
           ${lesson.body}, ${lesson.code_sample}, ${lesson.context_title},
           ${lesson.context_body}, ${tx.json(lesson.synthesis as never)},
           ${tx.json(lesson.content as never)}, ${lesson.position})
        returning id`;
      lessonIds.set(lesson.content_id, row.id);
    }

    const lessonByEvaluation = new Map<string, string>();
    const evaluationIds = new Map<string, string>();
    for (const [evaluationIndex, evaluation] of data.evaluations.entries()) {
      const lessonContentId = required(lessonIds, evaluation.lesson_content_id, "lección");
      const [row] = await tx<{ id: string }[]>`
        insert into evaluations
          (course_id, lesson_id, topic_id, content_id, title, description,
           question_count, exercise_count, position)
        values
          (${course.id}, ${lessonContentId},
           ${required(topicIds, evaluation.lesson_content_id, "subtema")},
           ${evaluation.content_id}, ${evaluation.title}, ${evaluation.description},
           ${evaluation.question_count}, ${evaluation.exercise_count}, ${evaluationIndex})
        returning id`;
      lessonByEvaluation.set(evaluation.content_id, evaluation.lesson_content_id);
      evaluationIds.set(evaluation.content_id, row.id);
    }

    for (const exercise of data.exercises) {
      await tx`insert into exercises
          (course_id, lesson_id, topic_id, content_id, type, prompt, instructions,
           correct_order, config, explanation, example, position)
        values
          (${course.id}, ${required(lessonIds, exercise.lesson_content_id, "lección")},
           ${required(topicIds, exercise.lesson_content_id, "subtema")},
           ${exercise.content_id}, ${exercise.type}, ${exercise.prompt}, ${exercise.instructions},
           ${tx.json(exercise.correct_order as never)}, ${tx.json(exercise.config as never)},
           ${exercise.explanation},
           ${exercise.example ? tx.json(exercise.example as never) : null}, ${exercise.position})`;
    }

    for (const example of data.examples) {
      await tx`insert into examples
          (course_id, lesson_id, topic_id, content_id, type, title, prompt, config, steps,
           hints, explanation, position)
        values
          (${course.id}, ${required(lessonIds, example.lesson_content_id, "lección")},
           ${required(topicIds, example.lesson_content_id, "subtema")},
           ${example.content_id}, ${example.type}, ${example.title}, ${example.prompt},
           ${tx.json(example.config as never)}, ${tx.json(example.steps as never)},
           ${tx.json(example.hints as never)}, ${example.explanation}, ${example.position})`;
    }

    for (const question of data.questions) {
      const lessonContentId = required(
        lessonByEvaluation,
        question.evaluation_content_id,
        "evaluación",
      );
      await tx`insert into questions
          (course_id, lesson_id, evaluation_id, content_id, type, prompt, options,
           answer, config, explanation, position)
        values
          (${course.id}, ${required(lessonIds, lessonContentId, "lección")},
           ${required(evaluationIds, question.evaluation_content_id, "evaluación")},
           ${question.content_id}, ${question.type}, ${question.prompt},
           ${tx.json(question.options as never)}, ${question.answer},
           ${tx.json(question.config as never)}, ${question.explanation},
           ${question.position})`;
    }

    await tx`
      insert into evaluation_exercises (evaluation_id, exercise_id)
      select e.id, selected.id
        from evaluations e
        join lateral (
          select x.id
            from exercises x
           where x.lesson_id = e.lesson_id
             and x.archived_at is null
           order by x.position, x.content_id
           limit e.exercise_count
        ) selected on true
       where e.course_id = ${course.id}
         and e.archived_at is null
      on conflict do nothing`;
  });

  const [publisher] = await sql<Teacher[]>`
    select id, name, email, role
      from teachers
     where role = 'admin'
     order by created_at
     limit 1`;
  if (!publisher) {
    throw new Error("Se necesita una cuenta administradora para publicar el contenido base.");
  }

  const [course] = await sql<Course[]>`
    select id, key, title, description, level, owner_id, is_base, is_group, uses_base, status,
           archived_at
      from courses
     where key = 'base'
     limit 1`;
  if (!course) throw new Error("No se pudo recuperar el curso base importado.");
  const release = await publishCourse(publisher, course);

  console.log(
    `Base importada: ${data.units.length} unidades, ${data.lessons.length} lecciones, ` +
      `${data.evaluations.length} evaluaciones, ${data.exercises.length} ejercicios, ` +
      `${data.examples.length} ejemplos y ${data.questions.length} preguntas. ` +
      `Release v${release.version} publicada.`,
  );
  await db().end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(error);
  await db()
    .end({ timeout: 5 })
    .catch(() => {});
  process.exit(1);
});
