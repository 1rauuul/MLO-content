import type { ContentBlock } from "@/lib/content";

export type Difficulty = "Fundamental" | "Intermedio" | "Avanzado";
export type UnitColor = "blue" | "violet" | "green";
export type ExerciseType = "order" | "fill" | "match" | "crossword";
export type ActivityType = ExerciseType | "mcq";

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

export type CoreLesson = {
  content_id: string;
  unit_content_id: string;
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
};

export type CoreEvaluation = {
  content_id: string;
  lesson_content_id: string;
  title: string;
  description: string;
  question_count: number;
  exercise_count: number;
};

export type CoreExercise = {
  content_id: string;
  lesson_content_id: string;
  type: ExerciseType;
  prompt: string;
  instructions: string;
  correct_order: string[];
  config: ExerciseConfig;
  explanation: string;
  example: ExerciseExample | null;
  position: number;
};

export type CoreExample = {
  content_id: string;
  lesson_content_id: string;
  type: ExerciseType;
  title: string;
  prompt: string;
  config: ExerciseConfig;
  steps: ExerciseStep[];
  hints: string[];
  explanation: string;
  position: number;
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
};

/** Archivo que produce `scripts/export-base.ts` en el repo de MLO. */
export type CoreCourse = {
  schemaVersion: 2;
  title: string;
  units: CoreUnit[];
  lessons: CoreLesson[];
  evaluations: CoreEvaluation[];
  exercises: CoreExercise[];
  examples: CoreExample[];
  questions: CoreQuestion[];
};
