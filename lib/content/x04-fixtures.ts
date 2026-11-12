import type { CoreCourse } from "./model";
import { buildGroupRelease } from "./group-release";
import { hashText } from "./hash";
import type { ReleaseV3 } from "./contract-v3";

/** Release v3 de grupo para X-04: jerarquía propia + bloques sobre el padre. */
export function buildX04Fixture(): ReleaseV3 {
  const own: CoreCourse = {
    schemaVersion: 2,
    title: "Grupo A",
    units: [
      {
        content_id: "gu1",
        number: 1,
        title: "Unidad del grupo",
        description: "",
        difficulty: "Fundamental",
        color: "green",
        position: 0,
      },
    ],
    topics: [
      {
        content_id: "gt1",
        unit_content_id: "gu1",
        title: "Subtema del grupo",
        summary: "",
        position: 0,
      },
    ],
    lessons: [
      {
        content_id: "gl1",
        unit_content_id: "gu1",
        topic_content_id: "gt1",
        code: "G1.1",
        title: "Lección del grupo",
        eyebrow: "",
        body: "",
        code_sample: "",
        context_title: "",
        context_body: "",
        synthesis: [],
        content: [{ type: "p", text: "Contenido propio del grupo." }],
        position: 0,
      },
    ],
    examples: [
      {
        content_id: "gex1",
        lesson_content_id: "gl1",
        topic_content_id: "gt1",
        type: "match",
        title: "Ejemplo del grupo",
        prompt: "Relaciona",
        config: {
          pairs: [
            { left: "A", right: "1" },
            { left: "B", right: "2" },
          ],
        },
        steps: [{ text: "Leer", why: "Da contexto." }],
        hints: [],
        explanation: "",
        position: 0,
      },
    ],
    exercises: [
      {
        content_id: "gord1",
        lesson_content_id: "gl1",
        topic_content_id: "gt1",
        type: "order",
        prompt: "Ordena",
        instructions: "",
        correct_order: ["A", "B"],
        config: {},
        explanation: "",
        example: null,
        position: 0,
      },
    ],
    evaluations: [
      {
        content_id: "gev1",
        lesson_content_id: "gl1",
        topic_content_id: "gt1",
        title: "Evaluación del grupo",
        description: "",
        question_count: 1,
        exercise_count: 1,
        position: 0,
        exercise_content_ids: ["gord1"],
      },
    ],
    questions: [
      {
        content_id: "gq1",
        evaluation_content_id: "gev1",
        type: "mcq",
        prompt: "¿Cuál?",
        options: ["A", "B"],
        answer: 0,
        config: {},
        explanation: "",
        position: 0,
      },
    ],
  };

  return buildGroupRelease({
    catalogId: "demo",
    groupId: "class-demo",
    contentCourseId: "course-group-demo",
    version: 1,
    publishedAt: "2026-11-06T00:00:00.000Z",
    name: "Grupo A",
    visibility: "published",
    courseRef: { version: 1, hash: hashText("x04-parent-v1") },
    own,
    externalTopicContentIds: [],
    additions: [
      {
        lessonContentId: "l1.1",
        blocks: [{ type: "p", text: "Bloque adicional del grupo." }],
      },
    ],
    externalExercises: [],
    externalExamples: [],
  });
}
