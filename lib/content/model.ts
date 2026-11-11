import type { ContentBlock } from "@/lib/content";
import type { UnitColor } from "./unit-colors";

export type Difficulty = "Fundamental" | "Intermedio" | "Avanzado";
export type { UnitColor } from "./unit-colors";
export type ExerciseType = "order" | "fill" | "match" | "crossword";
export type ActivityType = ExerciseType | "mcq";

/** DEC-07: metadatos editables; el texto APA 7 se genera al publicar. */
export type CoreReference = {
  content_id: string;
  authors: string[];
  year: number | null;
  title: string;
  source: string;
  edition: string;
  doi: string;
  url: string;
};

export type ExerciseStep = { text: string; why: string };

export type ExerciseExample = {
  title: string;
  steps: ExerciseStep[];
  hints: string[];
};

export type MatchPair = { left: string; right: string };

export type CrosswordEntry = {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
};

export type ExerciseConfig = {
  sentences?: string[];
  /** Palabras extra (distractores). Las respuestas salen de las oraciones. */
  bank?: string[];
  pairs?: MatchPair[];
  crossword?: { rows: number; cols: number; entries: CrosswordEntry[] };
};

export type CoreUnit = {
  content_id: string;
  number: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  color: UnitColor;
  position: number;
};

export type CoreTopic = {
  content_id: string;
  unit_content_id: string;
  title: string;
  summary: string;
  position: number;
};

export type CoreLesson = {
  content_id: string;
  unit_content_id: string;
  topic_content_id?: string;
  code: string;
  title: string;
  eyebrow: string;
  body: string;
  code_sample: string;
  context_title: string;
  context_body: string;
  synthesis: string[];
  content: ContentBlock[];
  position: number;
  reference_content_ids?: string[];
};

export type CoreEvaluation = {
  content_id: string;
  lesson_content_id: string;
  topic_content_id?: string;
  title: string;
  description: string;
  question_count: number;
  exercise_count: number;
  position?: number;
  exercise_content_ids?: string[];
  reference_content_ids?: string[];
};

export type CoreExercise = {
  content_id: string;
  lesson_content_id: string;
  topic_content_id?: string;
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correct_order: string[];
  config: ExerciseConfig;
  explanation: string;
  example: ExerciseExample | null;
  position: number;
  reference_content_ids?: string[];
};

export type CoreExample = {
  content_id: string;
  lesson_content_id: string;
  topic_content_id?: string;
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
  position: number;
  reference_content_ids?: string[];
};

export type CoreQuestion = {
  content_id: string;
  evaluation_content_id: string;
  type: ActivityType;
  prompt: string;
  options: string[];
  answer: number;
  config: ExerciseConfig;
  explanation: string;
  position: number;
  reference_content_ids?: string[];
};

/** Archivo que produce `scripts/export-base.ts` en el repo de MLO. */
export type CoreCourse = {
  schemaVersion: 2;
  title: string;
  units: CoreUnit[];
  topics?: CoreTopic[];
  lessons: CoreLesson[];
  evaluations: CoreEvaluation[];
  exercises: CoreExercise[];
  examples: CoreExample[];
  questions: CoreQuestion[];
  references?: CoreReference[];
};
