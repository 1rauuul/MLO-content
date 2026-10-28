import { parseBlocks, type ContentBlock } from "../content";
import { hashValue } from "./hash";
import type { ExerciseConfig, ExerciseStep, ExerciseType } from "./model";
import {
  parseExampleInput,
  parseExerciseInput,
  type ExampleInput,
  type ExerciseInput,
} from "./validate";

export type ExtraType = "lesson" | "example" | "exercise";

export type LessonExtraPayload = {
  title: string;
  blocks: ContentBlock[];
};

export type ExtraPayload = LessonExtraPayload | ExerciseInput | ExampleInput;

/** Fila mínima para componer el snapshot de una clase. */
export type ExtraForRelease = {
  id: string;
  type: ExtraType;
  payload: ExtraPayload;
  lesson_content_id: string;
  lesson_code: string;
  lesson_position: number;
};

export type ClassReleaseLesson = {
  lessonId: string;
  code: string;
  extras: { id: string; type: ExtraType; content: ExtraPayload }[];
};

export type ClassReleaseSnapshot = {
  schemaVersion: 2;
  class: { id: string; name: string; teacherName: string };
  version: number;
  hash: string;
  publishedAt: string;
  lessons: ClassReleaseLesson[];
};

type Parsed<T> = { value: T } | { error: string };
type Options = { strict?: boolean };

const EXTRA_TYPES: ExtraType[] = ["lesson", "example", "exercise"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isExtraType(value: unknown): value is ExtraType {
  return typeof value === "string" && EXTRA_TYPES.includes(value as ExtraType);
}

/**
 * Valida el contenido de un extra reutilizando las reglas de bloques,
 * ejercicios y ejemplos del resto del panel.
 */
export function parseExtraPayload(
  type: ExtraType,
  raw: unknown,
  options: Options = {},
): Parsed<ExtraPayload> {
  if (type === "lesson") {
    const record = isRecord(raw) ? raw : {};
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (title.length > 120) return { error: "El título no puede pasar de 120 caracteres." };

    const parsed = parseBlocks(JSON.stringify(Array.isArray(record.blocks) ? record.blocks : []));
    if ("error" in parsed) return { error: parsed.error };

    return { value: { title, blocks: parsed.blocks } };
  }

  if (type === "example") {
    const parsed = parseExampleInput(raw, {
      normalize: true,
      strict: options.strict,
    });
    return "error" in parsed ? parsed : { value: parsed.value };
  }

  const parsed = parseExerciseInput(raw, {
    normalize: true,
    strict: options.strict,
  });
  return "error" in parsed ? parsed : { value: parsed.value };
}

/** Texto corto para listas del panel. */
export function extraLabel(type: ExtraType, payload: unknown): string {
  if (!isRecord(payload)) return "Sin contenido";
  const value = type === "exercise" ? payload.prompt : payload.title;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (type === "lesson") return "Bloques de contenido";
  return "Sin título";
}

export function compareLessonCodes(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return left.localeCompare(right);
}

function snapshotBody(
  klass: ClassReleaseSnapshot["class"],
  extras: ExtraForRelease[],
): Omit<ClassReleaseSnapshot, "version" | "hash" | "publishedAt"> {
  const byLesson = new Map<string, ClassReleaseLesson>();

  for (const extra of extras) {
    const lesson = byLesson.get(extra.lesson_content_id) ?? {
      lessonId: extra.lesson_content_id,
      code: extra.lesson_code,
      extras: [],
    };
    lesson.extras.push({ id: extra.id, type: extra.type, content: extra.payload });
    byLesson.set(extra.lesson_content_id, lesson);
  }

  const lessons = [...byLesson.values()]
    .map((lesson) => ({
      ...lesson,
      extras: [...lesson.extras].sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort(
      (left, right) =>
        compareLessonCodes(left.code, right.code) || left.lessonId.localeCompare(right.lessonId),
    );

  return { schemaVersion: 2 as const, class: klass, lessons };
}

/** Hash del borrador: no depende de la versión ni de la fecha. */
export function classReleaseHash(
  klass: ClassReleaseSnapshot["class"],
  extras: ExtraForRelease[],
): string {
  return hashValue(snapshotBody(klass, extras));
}

/** Snapshot inmutable que MLO descarga para una clase. */
export function buildClassSnapshot(input: {
  class: ClassReleaseSnapshot["class"];
  version: number;
  publishedAt: string;
  extras: ExtraForRelease[];
}): ClassReleaseSnapshot {
  const body = snapshotBody(input.class, input.extras);
  return {
    ...body,
    version: input.version,
    hash: hashValue(body),
    publishedAt: input.publishedAt,
  };
}

/** Tipos del payload que el formulario maneja como borrador. */
export type ExtraExerciseDraft = {
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: ExerciseConfig;
  explanation: string;
};

export type ExtraExampleDraft = {
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
};
