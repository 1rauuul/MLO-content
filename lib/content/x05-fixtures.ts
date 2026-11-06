import type { CoreCourse } from "./model";
import { buildV3Release } from "./v3";
import type { ReleaseV3 } from "./contract-v3";

/**
 * Release v3 de X-05 (DEC-07): referencias APA 7 adjuntas a los cinco tipos de
 * elemento. `ref-apa-3` queda sin adjuntar para probar que no se publica.
 */
export function buildX05Fixture(): ReleaseV3 {
  const course: CoreCourse = {
    schemaVersion: 2,
    title: "Curso X-05 (bibliografía)",
    units: [
      {
        content_id: "u1",
        number: 1,
        title: "Fundamentos",
        description: "Unidad de ejemplo.",
        difficulty: "Fundamental",
        color: "blue",
        position: 0,
      },
    ],
    topics: [
      {
        content_id: "t1",
        unit_content_id: "u1",
        title: "Ingeniería de software",
        summary: "Lectura, actividades y evaluación con bibliografía.",
        position: 0,
      },
    ],
    lessons: [
      {
        content_id: "l1.1",
        unit_content_id: "u1",
        topic_content_id: "t1",
        code: "1.1",
        title: "Lectura con bibliografía",
        eyebrow: "Módulo 01 · Lección 01",
        body: "Contenido de lectura.",
        code_sample: "",
        context_title: "",
        context_body: "",
        synthesis: [],
        content: [{ type: "p", text: "Párrafo con una referencia." }],
        position: 0,
        reference_content_ids: ["ref-apa-1"],
      },
    ],
    evaluations: [
      {
        content_id: "ev1",
        lesson_content_id: "l1.1",
        topic_content_id: "t1",
        title: "Evaluación con bibliografía",
        description: "",
        question_count: 1,
        exercise_count: 1,
        position: 0,
        exercise_content_ids: ["ord1"],
        reference_content_ids: ["ref-apa-2"],
      },
    ],
    questions: [
      {
        content_id: "q1",
        evaluation_content_id: "ev1",
        type: "mcq",
        prompt: "¿Qué documento describe el proceso?",
        options: ["Libro", "Fotografía"],
        answer: 0,
        config: {},
        explanation: "",
        position: 0,
        reference_content_ids: ["ref-apa-1"],
      },
    ],
    exercises: [
      {
        content_id: "ord1",
        lesson_content_id: "l1.1",
        topic_content_id: "t1",
        type: "order",
        prompt: "Ordena las etapas",
        instructions: "",
        correct_order: ["Especificar", "Desarrollar", "Validar"],
        config: {},
        explanation: "",
        example: null,
        position: 0,
        reference_content_ids: ["ref-apa-1"],
      },
    ],
    examples: [
      {
        content_id: "ex1",
        lesson_content_id: "l1.1",
        topic_content_id: "t1",
        type: "match",
        title: "Relaciona conceptos",
        prompt: "Relaciona cada concepto",
        config: {
          pairs: [
            { left: "Requisito", right: "Necesidad" },
            { left: "Diseño", right: "Solución" },
          ],
        },
        steps: [{ text: "Leer", why: "Activa el conocimiento." }],
        hints: [],
        explanation: "",
        position: 0,
        reference_content_ids: ["ref-apa-2"],
      },
    ],
    references: [
      {
        content_id: "ref-apa-1",
        authors: ["Sommerville, I."],
        year: 2016,
        title: "Software Engineering",
        source: "Pearson",
        edition: "10.ª ed.",
        doi: "10.1000/182",
        url: "",
      },
      {
        content_id: "ref-apa-2",
        authors: ["Pressman, R. S.", "Maxim, B. R."],
        year: null,
        title: "Software Engineering: A Practitioner's Approach",
        source: "McGraw-Hill",
        edition: "",
        doi: "",
        url: "https://example.org/pressman",
      },
      {
        content_id: "ref-apa-3",
        authors: ["Sin, A."],
        year: 2020,
        title: "Referencia no adjunta",
        source: "Nadie",
        edition: "",
        doi: "",
        url: "",
      },
    ],
  };

  return buildV3Release({
    catalogId: "demo",
    courseId: "course-x05",
    version: 1,
    publishedAt: "2026-11-06T00:00:00.000Z",
    title: course.title,
    description: "Fixture X-05",
    baseRef: null,
    course,
  });
}
