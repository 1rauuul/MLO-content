import type {
  CoreEvaluation,
  CoreExample,
  CoreExercise,
  CoreLesson,
  CoreQuestion,
  CoreUnit,
  Difficulty,
  ExerciseExample,
  ExerciseType,
  UnitColor,
  ActivityType,
} from "./model";

export type PublishedUnit = {
  id: string;
  number: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  color: UnitColor;
};

export type PublishedLesson = {
  id: string;
  unitId: string;
  code: string;
  title: string;
  eyebrow: string;
  body: string;
  codeSample: string;
  contextTitle: string;
  contextBody: string;
  synthesis: string[];
  content: CoreLesson["content"];
  position: number;
};

export type PublishedEvaluation = {
  id: string;
  lessonId: string;
  title: string;
  description: string;
  questionCount: number;
  exerciseCount: number;
};

export type PublishedExercise = {
  id: string;
  lessonId: string;
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correctOrder: string[];
  config: unknown;
  explanation: string;
  example?: ExerciseExample;
};

export type PublishedExample = {
  id: string;
  lessonId: string;
  type: ExerciseType;
  title: string;
  prompt: string;
  config: unknown;
  steps: { text: string; why: string }[];
  hints: string[];
  explanation: string;
};

export type PublishedQuestion = {
  id: string;
  type: ActivityType;
  config: unknown;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type PublishedLessonPayload = {
  schemaVersion: 2;
  catalogId: string;
  lessonId: string;
  hash: string;
  unit: PublishedUnit;
  lesson: PublishedLesson;
  evaluation: PublishedEvaluation | null;
  exercises: PublishedExercise[];
  examples: PublishedExample[];
  questions: { evaluationId: string; question: PublishedQuestion }[];
};

export type SerializedLesson = Omit<PublishedLessonPayload, "hash">;

/**
 * Los ids publicados llevan la clave del curso delante; el core conserva los
 * originales. Una sola función evita prefijos distintos entre entidades.
 */
export function publishedId(catalogId: string, contentId: string): string {
  return catalogId === "base" ? contentId : `${catalogId}-${contentId}`;
}

export function serializeUnit(catalogId: string, unit: CoreUnit): PublishedUnit {
  return {
    id: publishedId(catalogId, unit.content_id),
    number: unit.number,
    title: unit.title,
    description: unit.description,
    difficulty: unit.difficulty,
    color: unit.color,
  };
}

export function serializeLesson(input: {
  catalogId: string;
  unit: CoreUnit;
  lesson: CoreLesson;
  evaluation: CoreEvaluation | null;
  exercises: CoreExercise[];
  examples: CoreExample[];
  questions: CoreQuestion[];
}): SerializedLesson {
  const { catalogId, unit, lesson, evaluation } = input;
  const lessonId = publishedId(catalogId, lesson.content_id);
  const publishedUnit = serializeUnit(catalogId, unit);

  return {
    schemaVersion: 2,
    catalogId,
    lessonId,
    unit: publishedUnit,
    lesson: {
      id: lessonId,
      unitId: publishedUnit.id,
      code: lesson.code,
      title: lesson.title,
      eyebrow: lesson.eyebrow,
      body: lesson.body,
      codeSample: lesson.code_sample,
      contextTitle: lesson.context_title,
      contextBody: lesson.context_body,
      synthesis: lesson.synthesis,
      content: lesson.content,
      position: lesson.position,
    },
    evaluation: evaluation
      ? {
          id: publishedId(catalogId, evaluation.content_id),
          lessonId,
          title: evaluation.title,
          description: evaluation.description,
          questionCount: evaluation.question_count,
          exerciseCount: evaluation.exercise_count,
        }
      : null,
    exercises: input.exercises.map((exercise) => ({
      id: publishedId(catalogId, exercise.content_id),
      lessonId,
      type: exercise.type,
      prompt: exercise.prompt,
      instructions: exercise.instructions,
      correctOrder: exercise.correct_order ?? [],
      config: exercise.config ?? {},
      explanation: exercise.explanation ?? "",
      ...(exercise.example ? { example: exercise.example } : {}),
    })),
    examples: input.examples.map((example) => ({
      id: publishedId(catalogId, example.content_id),
      lessonId,
      type: example.type,
      title: example.title,
      prompt: example.prompt,
      config: example.config ?? {},
      steps: example.steps,
      hints: example.hints,
      explanation: example.explanation,
    })),
    questions: input.questions.map((question) => ({
      evaluationId: evaluation ? publishedId(catalogId, evaluation.content_id) : "",
      question: {
        id: publishedId(catalogId, question.content_id),
        type: question.type,
        config: question.config ?? {},
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
      },
    })),
  };
}
