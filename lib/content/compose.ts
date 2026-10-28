import { hashValue } from "./hash";
import type { CoreCourse } from "./model";
import {
  publishedId,
  serializeLesson,
  type PublishedLessonPayload,
} from "./serialize";

export type ComposedCatalog = {
  catalogId: string;
  title: string;
  lessons: PublishedLessonPayload[];
};

export type CatalogManifest = {
  schemaVersion: 2;
  catalogId: string;
  title: string;
  version: string;
  hash: string;
  publishedAt: string;
  lessons: { lessonId: string; unitId: string; hash: string }[];
};

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    const list = groups.get(value);
    if (list) list.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

function indexUnique<T>(items: T[], key: (item: T) => string, label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const value = key(item);
    if (map.has(value)) throw new Error(`${label} repetido: ${value}`);
    map.set(value, item);
  }
  return map;
}

/**
 * Compone core + adiciones en el catálogo publicado. Recibe filas ya
 * filtradas (sin archivados) y solo cambia ids, nunca contenido.
 */
export function composeCatalog(catalogId: string, course: CoreCourse): ComposedCatalog {
  const units = indexUnique(course.units, (unit) => unit.content_id, "Unidad");
  indexUnique(course.lessons, (lesson) => lesson.content_id, "Lección");
  const evaluationsByLesson = indexUnique(
    course.evaluations,
    (evaluation) => evaluation.lesson_content_id,
    "Evaluación de la lección",
  );
  const exercisesByLesson = groupBy(course.exercises, (exercise) => exercise.lesson_content_id);
  const examplesByLesson = groupBy(course.examples, (example) => example.lesson_content_id);
  const questionsByEvaluation = groupBy(
    course.questions,
    (question) => question.evaluation_content_id,
  );

  const unitOrder = new Map(
    [...course.units]
      .sort((left, right) => left.number - right.number || left.position - right.position)
      .map((unit, index) => [unit.content_id, index]),
  );

  const ordered = [...course.lessons].sort((left, right) => {
    const unitDelta =
      (unitOrder.get(left.unit_content_id) ?? 0) - (unitOrder.get(right.unit_content_id) ?? 0);
    return unitDelta || left.position - right.position || left.code.localeCompare(right.code);
  });

  const payloads = ordered.map((lesson) => {
    const unit = units.get(lesson.unit_content_id);
    if (!unit) throw new Error(`La lección ${lesson.content_id} no tiene unidad.`);

    const evaluation = evaluationsByLesson.get(lesson.content_id) ?? null;
    const questions = evaluation
      ? questionsByEvaluation.get(evaluation.content_id) ?? []
      : [];

    if (evaluation && questions.length === 0) {
      throw new Error(`La evaluación ${evaluation.content_id} no tiene preguntas.`);
    }
    if (!evaluation && questions.length > 0) {
      throw new Error(`Hay preguntas sin evaluación en ${lesson.content_id}.`);
    }

    const serialized = serializeLesson({
      catalogId,
      unit,
      lesson,
      evaluation,
      exercises: exercisesByLesson.get(lesson.content_id) ?? [],
      examples: examplesByLesson.get(lesson.content_id) ?? [],
      questions,
    });

    return { ...serialized, hash: hashValue(serialized) };
  });

  if (payloads.length === 0) throw new Error("El curso no tiene lecciones para publicar.");

  // MLO exige ids únicos en todo el curso: unidad, lección, evaluación,
  // ejercicios, ejemplos y preguntas comparten un solo espacio.
  const ids = new Set<string>();
  const add = (id: string) => {
    if (ids.has(id)) throw new Error(`Id publicado repetido: ${id}`);
    ids.add(id);
  };
  for (const unit of course.units) add(publishedId(catalogId, unit.content_id));
  for (const lesson of course.lessons) add(publishedId(catalogId, lesson.content_id));
  for (const evaluation of course.evaluations) {
    add(publishedId(catalogId, evaluation.content_id));
  }
  for (const exercise of course.exercises) add(publishedId(catalogId, exercise.content_id));
  for (const example of course.examples) add(publishedId(catalogId, example.content_id));
  for (const question of course.questions) add(publishedId(catalogId, question.content_id));

  return { catalogId, title: course.title, lessons: payloads };
}

export function releaseHash(catalog: ComposedCatalog): string {
  return hashValue({
    schemaVersion: 2,
    catalogId: catalog.catalogId,
    title: catalog.title,
    lessons: [...catalog.lessons]
      .sort((left, right) => left.lessonId.localeCompare(right.lessonId))
      .map((lesson) => ({
        lessonId: lesson.lessonId,
        unitId: lesson.unit.id,
        hash: lesson.hash,
      })),
  });
}

export function buildManifest(
  catalog: ComposedCatalog,
  version: number,
  publishedAt: string,
): CatalogManifest {
  return {
    schemaVersion: 2,
    catalogId: catalog.catalogId,
    title: catalog.title,
    version: String(version),
    hash: releaseHash(catalog),
    publishedAt,
    lessons: catalog.lessons.map((lesson) => ({
      lessonId: lesson.lessonId,
      unitId: lesson.unit.id,
      hash: lesson.hash,
    })),
  };
}
