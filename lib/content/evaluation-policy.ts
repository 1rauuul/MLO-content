export const EVALUATION_QUESTION_COUNT = 10;
export const EVALUATION_EXERCISE_COUNT = 5;

export function evaluationComposition(exerciseIds: string[]): {
  kind: "mixed";
  label: string;
  isReady: boolean;
} {
  const available = new Set(exerciseIds).size;
  return {
    kind: "mixed",
    label: `${available} ${available === 1 ? "ejercicio disponible" : "ejercicios disponibles"} · se seleccionan ${EVALUATION_EXERCISE_COUNT}`,
    isReady: available >= EVALUATION_EXERCISE_COUNT,
  };
}
