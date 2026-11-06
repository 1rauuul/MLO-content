import { parseBlocks, type ContentBlock } from "@/lib/content";
import type { ExerciseConfig, MatchPair } from "./model";

export type PreviewResult = { correct: boolean; message: string };

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function checkOrder(correctOrder: string[], current: string[]): PreviewResult {
  const ok =
    correctOrder.length > 0 &&
    correctOrder.length === current.length &&
    correctOrder.every((item, index) => normalize(item) === normalize(current[index] ?? ""));
  return {
    correct: ok,
    message: ok ? "¡Correcto!" : "El orden todavía no es correcto.",
  };
}

export function fillHoles(sentences: string[]): string[] {
  const holes: string[] = [];
  for (const sentence of sentences) {
    for (const match of sentence.matchAll(/\{\{(.+?)\}\}/g)) {
      holes.push(match[1].trim());
    }
  }
  return holes;
}

export function checkFill(sentences: string[], answers: string[]): PreviewResult {
  const holes = fillHoles(sentences);
  const ok =
    holes.length > 0 &&
    holes.length === answers.length &&
    holes.every((hole, index) => normalize(hole) === normalize(answers[index] ?? ""));
  return {
    correct: ok,
    message: ok ? "¡Correcto!" : "Revisa las palabras de los huecos.",
  };
}

export function checkMatch(
  pairs: MatchPair[],
  selection: Record<string, string>,
): PreviewResult {
  const ok =
    pairs.length >= 2 &&
    pairs.every((pair) => pair.left.trim() !== "" && selection[pair.left] === pair.right);
  return {
    correct: ok,
    message: ok ? "¡Correcto!" : "Revisa las parejas.",
  };
}

export function crosswordSolution(config: ExerciseConfig): {
  rows: number;
  cols: number;
  cells: Record<string, string>;
} | null {
  const crossword = config.crossword;
  if (!crossword) return null;
  const cells: Record<string, string> = {};
  for (const entry of crossword.entries) {
    for (let offset = 0; offset < entry.word.length; offset += 1) {
      const row = entry.row + (entry.direction === "down" ? offset : 0);
      const col = entry.col + (entry.direction === "across" ? offset : 0);
      cells[`${row}-${col}`] = entry.word[offset]?.toUpperCase() ?? "";
    }
  }
  return { rows: crossword.rows, cols: crossword.cols, cells };
}

export function checkCrossword(
  config: ExerciseConfig,
  answers: Record<string, string>,
): PreviewResult {
  const solution = crosswordSolution(config);
  const keys = solution ? Object.keys(solution.cells) : [];
  const ok =
    keys.length > 0 &&
    keys.every((key) => normalize(answers[key] ?? "") === normalize(solution!.cells[key] ?? ""));
  return {
    correct: ok,
    message: ok ? "¡Correcto!" : "Revisa las letras del crucigrama.",
  };
}

export function checkMcq(
  options: string[],
  answer: number,
  selected: number | null,
): PreviewResult {
  const ok =
    options.length >= 2 &&
    Number.isInteger(answer) &&
    answer >= 0 &&
    answer < options.length &&
    selected === answer;
  return {
    correct: ok,
    message: ok ? "¡Correcto!" : "Elige la opción correcta.",
  };
}

export function evaluationComposition(exerciseIds: string[]): {
  kind: "questions" | "mixed";
  label: string;
} {
  if (exerciseIds.length === 0) {
    return { kind: "questions", label: "Solo preguntas" };
  }
  return {
    kind: "mixed",
    label: `${exerciseIds.length} ${exerciseIds.length === 1 ? "ejercicio" : "ejercicios"}`,
  };
}

/** Errores visibles del editor de bloques; coincide con parseBlocks al guardar. */
export function previewBlockErrors(blocks: ContentBlock[]): string[] {
  const parsed = parseBlocks(JSON.stringify(blocks));
  return "error" in parsed ? [parsed.error] : [];
}

/** Firma estable del borrador para reiniciar la actividad interactiva. */
export function previewActivitySignature(input: {
  type: string;
  correctOrder: string[];
  config: ExerciseConfig;
  options: string[];
  answer: number;
}): string {
  return JSON.stringify({
    type: input.type,
    correctOrder: input.correctOrder,
    config: input.config,
    options: input.options,
    answer: input.answer,
  });
}
