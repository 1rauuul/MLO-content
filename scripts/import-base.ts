/**
 * Importa el contenido base exportado por MLO (`scripts/export-base.ts`).
 * Es idempotente: reemplaza el contenido del curso `base` y conserva los
 * releases ya publicados como snapshots inmutables.
 *
 *   npm run import:base [ruta]
 */
import { readFileSync } from "node:fs";

import { db } from "../lib/db";
import type { CoreCourse } from "../lib/content/model";

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
      insert into courses (key, title, is_base)
      values ('base', ${data.title}, true)
      on conflict (key) do update set title = excluded.title
      returning id`;

    // units → lessons es restrict, así que se borra de hijos a padres.
    // Los releases no se tocan: son snapshots inmutables.
    await tx`delete from questions where course_id = ${course.id}`;
    await tx`delete from examples where course_id = ${course.id}`;
    await tx`delete from exercises where course_id = ${course.id}`;
    await tx`delete from evaluations where course_id = ${course.id}`;
    await tx`delete from lessons where course_id = ${course.id}`;
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
    for (const lesson of data.lessons) {
      const [row] = await tx<{ id: string }[]>`
        insert into lessons
          (course_id, unit_id, content_id, code, title, eyebrow, body, code_sample,
           context_title, context_body, synthesis, content, position)
        values
          (${course.id}, ${required(unitIds, lesson.unit_content_id, "unidad")},
           ${lesson.content_id}, ${lesson.code}, ${lesson.title}, ${lesson.eyebrow},
           ${lesson.body}, ${lesson.code_sample}, ${lesson.context_title},
           ${lesson.context_body}, ${tx.json(lesson.synthesis as never)},
           ${tx.json(lesson.content as never)}, ${lesson.position})
        returning id`;
      lessonIds.set(lesson.content_id, row.id);
    }

    const lessonByEvaluation = new Map<string, string>();
    for (const evaluation of data.evaluations) {
      await tx`insert into evaluations
          (course_id, lesson_id, content_id, title, description, question_count, exercise_count)
        values
          (${course.id}, ${required(lessonIds, evaluation.lesson_content_id, "lección")},
           ${evaluation.content_id}, ${evaluation.title}, ${evaluation.description},
           ${evaluation.question_count}, ${evaluation.exercise_count})`;
      lessonByEvaluation.set(evaluation.content_id, evaluation.lesson_content_id);
    }

    for (const exercise of data.exercises) {
      await tx`insert into exercises
          (course_id, lesson_id, content_id, type, prompt, instructions,
           correct_order, config, explanation, example, position)
        values
          (${course.id}, ${required(lessonIds, exercise.lesson_content_id, "lección")},
           ${exercise.content_id}, ${exercise.type}, ${exercise.prompt}, ${exercise.instructions},
           ${tx.json(exercise.correct_order as never)}, ${tx.json(exercise.config as never)},
           ${exercise.explanation},
           ${exercise.example ? tx.json(exercise.example as never) : null}, ${exercise.position})`;
    }

    for (const example of data.examples) {
      await tx`insert into examples
          (course_id, lesson_id, content_id, type, title, prompt, config, steps,
           hints, explanation, position)
        values
          (${course.id}, ${required(lessonIds, example.lesson_content_id, "lección")},
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
          (course_id, lesson_id, content_id, type, prompt, options, answer, config,
           explanation, position)
        values
          (${course.id}, ${required(lessonIds, lessonContentId, "lección")},
           ${question.content_id}, ${question.type}, ${question.prompt},
           ${tx.json(question.options as never)}, ${question.answer},
           ${tx.json(question.config as never)}, ${question.explanation},
           ${question.position})`;
    }
  });

  console.log(
    `Base importada: ${data.units.length} unidades, ${data.lessons.length} lecciones, ` +
      `${data.evaluations.length} evaluaciones, ${data.exercises.length} ejercicios, ` +
      `${data.examples.length} ejemplos y ${data.questions.length} preguntas.`,
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
