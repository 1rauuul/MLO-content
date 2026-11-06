import type { ContentBlock } from "../content";
import type { ReleaseV3 } from "./contract-v3";
import { hashValue } from "./hash";
import type { CoreCourse, CoreExample, CoreExercise } from "./model";
import { publishedId } from "./serialize";
import { buildV3Release } from "./v3";

export type GroupCourseRef = { version: number; hash: string };

export type GroupAddition = {
  lessonContentId: string;
  blocks: ContentBlock[];
};

export type GroupReleaseInput = {
  catalogId: string;
  groupId: string;
  contentCourseId: string;
  version: number;
  publishedAt: string;
  name: string;
  visibility: "published" | "unpublished";
  courseRef: GroupCourseRef;
  own: CoreCourse;
  additions: GroupAddition[];
  externalExercises: CoreExercise[];
  externalExamples: CoreExample[];
};

/**
 * Release v3 de grupo. Los recursos propios se construyen con el mismo builder
 * de curso usando el prefijo `g-<groupId>-`; los extras legacy se adjuntan al
 * subtema del curso padre y los bloques van en `additions`.
 */
export function buildGroupRelease(input: GroupReleaseInput): ReleaseV3 {
  const prefix = `g-${input.groupId}`;
  const own = buildV3Release({
    catalogId: prefix,
    courseId: input.contentCourseId,
    version: input.version,
    publishedAt: input.publishedAt,
    title: input.name,
    description: "",
    baseRef: null,
    course: input.own,
  });

  const content = {
    schemaVersion: 3 as const,
    kind: "group" as const,
    catalogId: input.catalogId,
    groupId: input.groupId,
    releaseId: `${input.groupId}-${input.version}`,
    version: input.version,
    publishedAt: input.publishedAt,
    courseRef: input.courseRef,
    group: {
      name: input.name,
      visibility: input.visibility,
    },
    units: own.units,
    topics: own.topics,
    lessons: own.lessons,
    evaluations: own.evaluations,
    questions: own.questions,
    exercises: [
      ...(own.exercises as unknown[]),
      ...input.externalExercises.map((exercise) => ({
        id: `${prefix}-${exercise.content_id}`,
        topicId: publishedId(input.catalogId, exercise.topic_content_id ?? ""),
        type: exercise.type,
        prompt: exercise.prompt,
        instructions: exercise.instructions,
        correctOrder: exercise.correct_order,
        config: exercise.config,
        explanation: exercise.explanation,
        example: exercise.example ?? null,
        position: exercise.position,
      })),
    ],
    examples: [
      ...(own.examples as unknown[]),
      ...input.externalExamples.map((example) => ({
        id: `${prefix}-${example.content_id}`,
        topicId: publishedId(input.catalogId, example.topic_content_id ?? ""),
        type: example.type,
        title: example.title,
        prompt: example.prompt,
        config: example.config,
        steps: example.steps,
        hints: example.hints,
        explanation: example.explanation,
        position: example.position,
      })),
    ],
    additions: input.additions.map((addition) => ({
      lessonId: publishedId(input.catalogId, addition.lessonContentId),
      blocks: addition.blocks,
    })),
    references: own.references,
    notices: [],
  };

  return { ...content, hash: hashValue(content) };
}

export type JoinCheckInput = {
  archived: boolean;
  capacity: number | null;
  activeMembers: number;
  hasActiveMembershipInCourse: boolean;
};

export type JoinCheck =
  | { ok: true }
  | { ok: false; reason: "archived" | "full" | "duplicate" };

export function canJoinGroup(input: JoinCheckInput): JoinCheck {
  if (input.archived) return { ok: false, reason: "archived" };
  if (input.hasActiveMembershipInCourse) return { ok: false, reason: "duplicate" };
  if (input.capacity !== null && input.activeMembers >= input.capacity) {
    return { ok: false, reason: "full" };
  }
  return { ok: true };
}

export type GroupVisibilityInput = {
  archived: boolean;
};

export function groupVisibility(input: GroupVisibilityInput): "published" | "unpublished" {
  return input.archived ? "unpublished" : "published";
}
