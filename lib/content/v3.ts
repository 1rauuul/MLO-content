import type { ReleaseV3 } from "./contract-v3";
import { hashValue } from "./hash";
import type { CoreCourse, CoreQuestion, CoreTopic } from "./model";
import { publishedId } from "./serialize";

export type CourseStatus = "draft" | "published" | "unpublished";

export type BaseRef = {
  catalogId: string;
  version: number;
  hash: string;
};

export type LatestRelease = {
  version: number;
  hash: string;
};

/** DEC-02: el baseRef solo existe si el curso declara uso del contenido base. */
export function resolveBaseRef(
  usesBase: boolean,
  latestBaseRelease: LatestRelease | null,
): BaseRef | null {
  if (!usesBase) return null;
  if (!latestBaseRelease) {
    throw new Error("El contenido base no tiene una release v2 publicada.");
  }
  return {
    catalogId: "base",
    version: latestBaseRelease.version,
    hash: latestBaseRelease.hash,
  };
}

/** Una sola secuencia de versiones para v2 y v3 del mismo curso. */
export function nextReleaseVersion(
  latestV2: number | null,
  latestV3: number | null,
): number {
  return Math.max(latestV2 ?? 0, latestV3 ?? 0) + 1;
}

/** El base solo entra en la composición v2 cuando el curso lo declara. */
export function sourceCourseIds(
  usesBase: boolean,
  baseId: string | null,
  courseId: string,
): string[] {
  return usesBase && baseId && baseId !== courseId ? [baseId, courseId] : [courseId];
}

/** El curso interno de un grupo no se publica como curso. */
export function assertPublishableCourse(input: { is_group: boolean }): void {
  if (input.is_group) {
    throw new Error("El contenido interno de un grupo no se publica como curso.");
  }
}

export type EmptyReleaseInput = {
  catalogId: string;
  courseId: string;
  version: number;
  publishedAt: string;
  title: string;
  baseRef: BaseRef | null;
};

export type V3ReleaseInput = {
  catalogId: string;
  courseId: string;
  version: number;
  publishedAt: string;
  title: string;
  description?: string;
  baseRef: BaseRef | null;
  course: CoreCourse;
};

/**
 * Construye el release v3 real desde las filas editoriales. Los ids se
 * publican con `publishedId`; las evaluaciones incluyen sus preguntas y los
 * ejercicios seleccionados en `evaluation_exercises`.
 */
export function buildV3Release(input: V3ReleaseInput): ReleaseV3 {
  const itemId = (contentId: string) => publishedId(input.catalogId, contentId);
  const course = input.course;

  const units = [...course.units].sort(
    (left, right) =>
      left.number - right.number ||
      left.position - right.position ||
      left.content_id.localeCompare(right.content_id),
  );
  const unitOrder = new Map(units.map((unit, order) => [unit.content_id, order]));

  const topics = [...(course.topics ?? [])].sort(
    (left, right) =>
      (unitOrder.get(left.unit_content_id) ?? -1) -
        (unitOrder.get(right.unit_content_id) ?? -1) ||
      left.position - right.position ||
      left.content_id.localeCompare(right.content_id),
  );
  const topicOrder = new Map(topics.map((topic, order) => [topic.content_id, order]));
  const rank = (topicId: string | undefined) =>
    topicId === undefined ? Number.MAX_SAFE_INTEGER : topicOrder.get(topicId) ?? Number.MAX_SAFE_INTEGER;

  const lessons = [...course.lessons].sort(
    (left, right) =>
      rank(left.topic_content_id) - rank(right.topic_content_id) ||
      left.position - right.position ||
      left.code.localeCompare(right.code) ||
      left.content_id.localeCompare(right.content_id),
  );
  const examples = [...course.examples].sort(
    (left, right) =>
      rank(left.topic_content_id) - rank(right.topic_content_id) ||
      left.position - right.position ||
      left.content_id.localeCompare(right.content_id),
  );
  const exercises = [...course.exercises].sort(
    (left, right) =>
      rank(left.topic_content_id) - rank(right.topic_content_id) ||
      left.position - right.position ||
      left.content_id.localeCompare(right.content_id),
  );
  const evaluations = [...course.evaluations].sort(
    (left, right) =>
      rank(left.topic_content_id) - rank(right.topic_content_id) ||
      (left.position ?? 0) - (right.position ?? 0) ||
      left.content_id.localeCompare(right.content_id),
  );
  const evaluationOrder = new Map(
    evaluations.map((evaluation, order) => [evaluation.content_id, order]),
  );

  const questions = [...course.questions].sort(
    (left, right) =>
      (evaluationOrder.get(left.evaluation_content_id) ?? Number.MAX_SAFE_INTEGER) -
        (evaluationOrder.get(right.evaluation_content_id) ?? Number.MAX_SAFE_INTEGER) ||
      left.position - right.position ||
      left.content_id.localeCompare(right.content_id),
  );
  const questionsByEvaluation = new Map<string, CoreQuestion[]>();
  for (const question of questions) {
    const bucket = questionsByEvaluation.get(question.evaluation_content_id) ?? [];
    bucket.push(question);
    questionsByEvaluation.set(question.evaluation_content_id, bucket);
  }

  const content = {
    schemaVersion: 3 as const,
    kind: "course" as const,
    catalogId: input.catalogId,
    courseId: input.courseId,
    releaseId: `${input.catalogId}-${input.version}`,
    version: input.version,
    publishedAt: input.publishedAt,
    baseRef: input.baseRef,
    course: {
      title: input.title,
      description: input.description ?? "",
      visibility: "published" as const,
    },
    units: units.map((unit) => ({
      id: itemId(unit.content_id),
      number: unit.number,
      title: unit.title,
      description: unit.description,
      difficulty: unit.difficulty,
      color: unit.color,
      position: unit.position,
    })),
    topics: topics.map((topic: CoreTopic) => ({
      id: itemId(topic.content_id),
      unitId: itemId(topic.unit_content_id),
      title: topic.title,
      summary: topic.summary,
      position: topic.position,
    })),
    lessons: lessons.map((lesson) => ({
      id: itemId(lesson.content_id),
      topicId: itemId(lesson.topic_content_id ?? ""),
      code: lesson.code,
      title: lesson.title,
      eyebrow: lesson.eyebrow,
      body: lesson.body,
      content: lesson.content,
      position: lesson.position,
    })),
    evaluations: evaluations.map((evaluation) => ({
      id: itemId(evaluation.content_id),
      topicId: itemId(evaluation.topic_content_id ?? ""),
      title: evaluation.title,
      description: evaluation.description,
      position: evaluation.position ?? 0,
      questionIds: (questionsByEvaluation.get(evaluation.content_id) ?? []).map((question) =>
        itemId(question.content_id),
      ),
      exerciseIds: (evaluation.exercise_content_ids ?? []).map(itemId),
    })),
    questions: questions.map((question) => ({
      id: itemId(question.content_id),
      evaluationId: itemId(question.evaluation_content_id),
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      answer: question.answer,
      config: question.config,
      explanation: question.explanation,
      position: question.position,
    })),
    exercises: exercises.map((exercise) => ({
      id: itemId(exercise.content_id),
      topicId: itemId(exercise.topic_content_id ?? ""),
      type: exercise.type,
      prompt: exercise.prompt,
      instructions: exercise.instructions,
      correctOrder: exercise.correct_order,
      config: exercise.config,
      explanation: exercise.explanation,
      example: exercise.example ?? null,
      position: exercise.position,
    })),
    examples: examples.map((example) => ({
      id: itemId(example.content_id),
      topicId: itemId(example.topic_content_id ?? ""),
      type: example.type,
      title: example.title,
      prompt: example.prompt,
      config: example.config,
      steps: example.steps,
      hints: example.hints,
      explanation: example.explanation,
      position: example.position,
    })),
    references: [],
    notices: [],
  };

  return { ...content, hash: hashValue(content) };
}

/**
 * Release metadata vacío. Se conserva para X-02 y para cursos sin jerarquía.
 */
export function buildEmptyV3Release(input: EmptyReleaseInput): ReleaseV3 {
  return buildV3Release({
    ...input,
    description: "",
    course: {
      schemaVersion: 2,
      title: input.title,
      units: [],
      topics: [],
      lessons: [],
      evaluations: [],
      exercises: [],
      examples: [],
      questions: [],
    },
  });
}

export type CourseListEntry = {
  catalogId: string;
  title: string;
  status: "published";
  usesBase: boolean;
  version: number;
  hash: string;
  publishedAt: string;
  empty: boolean;
};

export type CourseListResponse = {
  schemaVersion: 3;
  courses: CourseListEntry[];
};

export type CourseCandidate = {
  catalogId: string;
  title: string;
  status: CourseStatus;
  usesBase: boolean;
  isBase: boolean;
  hasAccess: boolean;
  version: number | null;
  hash: string | null;
  publishedAt: string | null;
  empty: boolean;
};

export function canAccessCourse(input: {
  isBase: boolean;
  status: CourseStatus;
  hasGrant: boolean;
  accessControlOn: boolean;
}): boolean {
  if (input.status !== "published") return false;
  // El flag de piloto solo permite el base empaquetado; nunca cursos adicionales.
  if (input.isBase && !input.accessControlOn) return true;
  return input.hasGrant;
}

export function accessControlEnabled(value: string | undefined): boolean {
  return value === "on";
}

/**
 * v2 sigue sirviendo el base sin cabecera. Cualquier otro catálogo exige
 * identidad válida, curso publicado y concesión explícita.
 */
export function canAccessV2Catalog(input: {
  catalogId: string;
  status: CourseStatus;
  hasGrant: boolean;
  hasValidStudentKey: boolean;
}): boolean {
  if (input.catalogId === "base") return true;
  return input.hasValidStudentKey && input.status === "published" && input.hasGrant;
}

export function computeEmpty(input: {
  isBase: boolean;
  usesBase: boolean;
  ownLessons: number;
  baseLessons: number;
}): boolean {
  if (input.isBase) return input.ownLessons === 0;
  return input.ownLessons === 0 && (!input.usesBase || input.baseLessons === 0);
}

export function buildAuthorizedCourseList(
  candidates: CourseCandidate[],
  accessControlOn: boolean,
): CourseListResponse {
  const courses: CourseListEntry[] = [];

  for (const candidate of candidates) {
    if (candidate.version === null || candidate.hash === null || candidate.publishedAt === null) {
      continue;
    }
    if (
      !canAccessCourse({
        isBase: candidate.isBase,
        status: candidate.status,
        hasGrant: candidate.hasAccess,
        accessControlOn,
      })
    ) {
      continue;
    }
    courses.push({
      catalogId: candidate.catalogId,
      title: candidate.title,
      status: "published",
      usesBase: candidate.usesBase,
      version: candidate.version,
      hash: candidate.hash,
      publishedAt: candidate.publishedAt,
      empty: candidate.empty,
    });
  }

  return { schemaVersion: 3, courses };
}
