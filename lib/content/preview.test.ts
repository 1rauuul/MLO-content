import assert from "node:assert/strict";
import test from "node:test";

import {
  checkCrossword,
  checkFill,
  checkMatch,
  checkMcq,
  checkOrder,
  crosswordSolution,
  evaluationComposition,
  fillHoles,
  previewActivitySignature,
  previewBlockErrors,
} from "./preview";
import {
  parseExampleInput,
  parseExerciseInput,
  parseQuestionInput,
} from "./validate";

test("order comprueba la secuencia completa", () => {
  assert.equal(checkOrder(["A", "B"], ["A", "B"]).correct, true);
  assert.equal(checkOrder(["A", "B"], ["B", "A"]).correct, false);
  assert.equal(checkOrder(["A", "B"], ["A"]).correct, false);
});

test("fill extrae huecos y compara sin distinguir mayúsculas", () => {
  const sentences = ["El {{requisito}} y el {{Diseño}} importan."];
  assert.deepEqual(fillHoles(sentences), ["requisito", "Diseño"]);
  assert.equal(checkFill(sentences, ["REQUISITO", "diseño"]).correct, true);
  assert.equal(checkFill(sentences, ["requisito", "otro"]).correct, false);
  assert.deepEqual(fillHoles(["Sin huecos"]), []);
});

test("match exige todas las parejas y mínimo dos", () => {
  const pairs = [
    { left: "A", right: "1" },
    { left: "B", right: "2" },
  ];
  assert.equal(checkMatch(pairs, { A: "1", B: "2" }).correct, true);
  assert.equal(checkMatch(pairs, { A: "2", B: "1" }).correct, false);
  assert.equal(checkMatch([pairs[0]], { A: "1" }).correct, false);
});

test("crossword resuelve celdas y compara letras", () => {
  const config = {
    crossword: {
      rows: 2,
      cols: 2,
      entries: [
        { word: "SOL", clue: "Estrella", row: 0, col: 0, direction: "across" as const },
        { word: "SAL", clue: "Condimento", row: 0, col: 0, direction: "down" as const },
      ],
    },
  };
  // La palabra SOL no cabe en 2x2; el helper no valida, solo proyecta.
  const solution = crosswordSolution(config);
  assert.ok(solution);
  assert.equal(solution.cells["0-0"], "S");
  assert.equal(checkCrossword(config, solution.cells).correct, true);
  assert.equal(checkCrossword(config, { "0-0": "X" }).correct, false);
});

test("mcq exige índice válido y opción seleccionada", () => {
  assert.equal(checkMcq(["A", "B"], 1, 1).correct, true);
  assert.equal(checkMcq(["A", "B"], 1, 0).correct, false);
  assert.equal(checkMcq(["A"], 0, 0).correct, false);
  assert.equal(checkMcq(["A", "B"], 2, 2).correct, false);
});

test("evaluación solo de preguntas o mixta", () => {
  assert.deepEqual(evaluationComposition([]), {
    kind: "questions",
    label: "Solo preguntas",
  });
  assert.deepEqual(evaluationComposition(["a"]), {
    kind: "mixed",
    label: "1 ejercicio",
  });
  assert.deepEqual(evaluationComposition(["a", "b"]), {
    kind: "mixed",
    label: "2 ejercicios",
  });
});

test("errores visibles de bloques coinciden con el guardado", () => {
  assert.ok(previewBlockErrors([]).length > 0);
  assert.ok(previewBlockErrors([{ type: "p", text: "" }]).length > 0);
  assert.ok(
    previewBlockErrors([
      { type: "table", header: ["A", "B"], rows: [["1"]] },
    ]).length > 0,
  );
  assert.ok(previewBlockErrors([{ type: "bullets", items: [] }]).length > 0);
  assert.deepEqual(
    previewBlockErrors([{ type: "p", text: "Texto válido" }]),
    [],
  );
});

test("la firma de preview cambia cuando cambia el borrador relevante", () => {
  const base = {
    type: "fill",
    correctOrder: [] as string[],
    config: { sentences: ["El {{requisito}} importa."] },
    options: [] as string[],
    answer: 0,
  };
  const signature = previewActivitySignature(base);

  assert.equal(
    signature,
    previewActivitySignature({
      ...base,
      config: { sentences: ["El {{requisito}} importa."] },
    }),
  );
  assert.notEqual(
    signature,
    previewActivitySignature({ ...base, config: { sentences: ["El {{diseño}} importa."] } }),
  );
  assert.notEqual(
    signature,
    previewActivitySignature({ ...base, correctOrder: ["A", "B"] }),
  );
  assert.notEqual(signature, previewActivitySignature({ ...base, options: ["A", "B"] }));
  assert.notEqual(signature, previewActivitySignature({ ...base, answer: 1 }));
  assert.notEqual(signature, previewActivitySignature({ ...base, type: "match" }));
});

test("los validadores puros reportan errores de borrador", () => {
  assert.ok(
    "error" in
      parseExerciseInput({
        type: "order",
        prompt: "",
        instructions: "",
        correctOrder: [],
        config: {},
        explanation: "",
        example: null,
      }),
  );
  assert.ok(
    "error" in
      parseExerciseInput({
        type: "fill",
        prompt: "Completa",
        instructions: "",
        correctOrder: [],
        config: { sentences: ["Sin huecos"], bank: [] },
        explanation: "",
        example: null,
      }),
  );
  assert.ok(
    "error" in
      parseExerciseInput({
        type: "match",
        prompt: "Relaciona",
        instructions: "",
        correctOrder: [],
        config: { pairs: [{ left: "A", right: "1" }] },
        explanation: "",
        example: null,
      }),
  );
  assert.ok(
    "error" in
      parseExerciseInput({
        type: "crossword",
        prompt: "Crucigrama",
        instructions: "",
        correctOrder: [],
        config: {
          crossword: {
            rows: 1,
            cols: 1,
            entries: [{ word: "SOL", clue: "Estrella", row: 0, col: 0, direction: "across" }],
          },
        },
        explanation: "",
        example: null,
      }),
  );
  assert.ok(
    "error" in
      parseExampleInput({
        type: "match",
        title: "",
        prompt: "",
        config: {},
        steps: [],
        hints: [],
        explanation: "",
      }),
  );
  assert.ok(
    "error" in
      parseQuestionInput({
        type: "mcq",
        prompt: "¿Cuál?",
        options: ["A"],
        answer: 0,
      }),
  );
});
