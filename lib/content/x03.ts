import type { CoreTopic } from "./model";

/** Alcance del editor: el curso interno de un grupo nunca compone con el base. */
export function editorCourseIds(
  isGroup: boolean,
  courseId: string,
  baseId: string | null,
): string[] {
  if (isGroup || !baseId || baseId === courseId) return [courseId];
  return [baseId, courseId];
}

/** Errores de unicidad de PostgreSQL (incluye el índice de membresía activa). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

/** DEC-03: id determinista del subtema creado desde una lección v2. */
export function topicContentId(lessonContentId: string): string {
  return `t-${lessonContentId}`;
}

/**
 * Filas de topics equivalentes al backfill SQL: una por lección, misma unidad,
 * título y posición. La migración replica esta regla.
 */
export function backfillTopics(
  lessons: {
    content_id: string;
    unit_content_id: string;
    title: string;
    position: number;
  }[],
): CoreTopic[] {
  return lessons.map((lesson) => ({
    content_id: topicContentId(lesson.content_id),
    unit_content_id: lesson.unit_content_id,
    title: lesson.title,
    summary: "",
    position: lesson.position,
  }));
}

/**
 * v2 solo admite una evaluación por lección. Se elige la primaria por
 * `position`, luego `content_id`. v3 conserva todas.
 */
export function selectPrimaryEvaluations<
  T extends { content_id: string; lesson_content_id: string; position?: number },
>(evaluations: T[]): T[] {
  const sorted = [...evaluations].sort(
    (left, right) =>
      left.lesson_content_id.localeCompare(right.lesson_content_id) ||
      (left.position ?? 0) - (right.position ?? 0) ||
      left.content_id.localeCompare(right.content_id),
  );
  const seen = new Set<string>();
  const primary: T[] = [];
  for (const evaluation of sorted) {
    if (seen.has(evaluation.lesson_content_id)) continue;
    seen.add(evaluation.lesson_content_id);
    primary.push(evaluation);
  }
  return primary;
}

/** Vecino de orden para las acciones de reordenar; no crea huérfanos. */
export function reorderNeighbor<T extends { id: string; position: number }>(
  rows: T[],
  id: string,
  direction: string,
): { current: T; neighbor: T } | null {
  const sorted = [...rows].sort(
    (left, right) => left.position - right.position || left.id.localeCompare(right.id),
  );
  const index = sorted.findIndex((row) => row.id === id);
  const target = index + (direction === "down" ? 1 : -1);
  if (index < 0 || target < 0 || target >= sorted.length) return null;
  return { current: sorted[index], neighbor: sorted[target] };
}
