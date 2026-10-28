import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { CoreCourse } from "./model";
import {
  parseExampleInput,
  parseExerciseInput,
  validateCatalogForPublish,
} from "./validate";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "scripts/fixtures/base-course.json"), "utf8"),
) as CoreCourse;

const crossword = {
  crossword: {
    rows: 8,
    cols: 8,
    entries: [
      { word: "SOL", clue: "Astro del día", row: 0, col: 0, direction: "across" },
      { word: "SAL", clue: "Condimento", row: 0, col: 0, direction: "down" },
    ],
  },
  bank: ["LUNA"],
};

test("acepta un ejercicio de cada tipo", () => {
  const order = parseExerciseInput({
    type: "order",
    prompt: "Ordena",
    instructions: "",
    correctOrder: ["Uno", "Dos"],
    explanation: "",
    example: null,
  });
  assert.ok("value" in order);

  const fill = parseExerciseInput({
    type: "fill",
    prompt: "Completa",
    instructions: "",
    config: { sentences: ["El {{sol}} sale."], bank: ["luna"] },
    explanation: "",
    example: null,
  });
  assert.ok("value" in fill);

  const match = parseExerciseInput({
    type: "match",
    prompt: "Enlaza",
    instructions: "",
    config: { pairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }] },
    explanation: "",
    example: null,
  });
  assert.ok("value" in match);

  const cross = parseExerciseInput({
    type: "crossword",
    prompt: "Crucigrama",
    instructions: "",
    config: crossword,
    explanation: "",
    example: null,
  });
  assert.ok("value" in cross);
});

test("rechaza los casos inválidos de cada tipo", () => {
  const order = parseExerciseInput({
    type: "order",
    prompt: "Ordena",
    correctOrder: ["Uno", "Uno"],
  });
  assert.ok("error" in order);

  const fill = parseExerciseInput({
    type: "fill",
    prompt: "Completa",
    config: { sentences: ["Sin espacio"], bank: [] },
  });
  assert.ok("error" in fill);

  const match = parseExerciseInput({
    type: "match",
    prompt: "Enlaza",
    config: { pairs: [{ left: "A", right: "1" }, { left: "A", right: "2" }] },
  });
  assert.ok("error" in match);

  const cross = parseExerciseInput({
    type: "crossword",
    prompt: "Crucigrama",
    config: {
      crossword: {
        rows: 5,
        cols: 5,
        entries: [
          { word: "SOL", clue: "Uno", row: 0, col: 0, direction: "across" },
          { word: "SAL", clue: "Otro", row: 0, col: 1, direction: "down" },
        ],
      },
    },
  });
  assert.ok("error" in cross);
});

test("normaliza el crucigrama al guardar y lo exige en mayúsculas al publicar", () => {
  const raw = {
    type: "crossword",
    prompt: "Crucigrama",
    config: {
      crossword: {
        rows: 5,
        cols: 5,
        entries: [{ word: "sol", clue: "Astro", row: 0, col: 0, direction: "across" }],
      },
      bank: ["luna"],
    },
  };
  const normalized = parseExerciseInput(raw, { normalize: true });
  assert.ok("value" in normalized);
  assert.equal(normalized.value.config.crossword?.entries[0]?.word, "SOL");

  const strict = parseExerciseInput(raw, { strict: true });
  assert.ok("error" in strict);
});

test("valida los pasos y las pistas del ejemplo", () => {
  const exercise = parseExerciseInput({
    type: "order",
    prompt: "Ordena",
    correctOrder: ["Uno", "Dos"],
    example: { title: "Ejemplo", steps: [{ text: "Paso", why: "Porque sí" }], hints: [] },
  });
  assert.ok("value" in exercise);

  const noSteps = parseExerciseInput({
    type: "order",
    prompt: "Ordena",
    correctOrder: ["Uno", "Dos"],
    example: { title: "Ejemplo", steps: [], hints: [] },
  });
  assert.ok("error" in noSteps);

  const blankWhy = parseExampleInput({
    type: "fill",
    title: "Ejemplo",
    prompt: "Completa",
    config: { sentences: ["El {{sol}}."], bank: [] },
    steps: [{ text: "Paso", why: "" }],
    hints: [],
    explanation: "",
  });
  assert.ok("error" in blankWhy);
});

test("un ejemplo independiente no puede ser de ordenar", () => {
  const orderExample = parseExampleInput({
    type: "order",
    title: "Ejemplo de ordenar",
    prompt: "Ordena",
    config: {},
    steps: [{ text: "Paso", why: "Porque sí" }],
    hints: [],
    explanation: "",
  });
  assert.ok("error" in orderExample);

  const orderExercise = parseExerciseInput({
    type: "order",
    prompt: "Ordena",
    correctOrder: ["Uno", "Dos"],
    example: { title: "Ejemplo", steps: [{ text: "Paso", why: "Porque sí" }], hints: [] },
  });
  assert.ok("value" in orderExercise);
});

test("el core completo pasa la validación de publicación", () => {
  validateCatalogForPublish(fixture);
});

test("la publicación rechaza un ejercicio inválido", () => {
  const broken: CoreCourse = {
    ...fixture,
    exercises: fixture.exercises.map((exercise, index) =>
      index === 0 ? { ...exercise, correct_order: ["Uno"] } : exercise,
    ),
  };
  assert.throws(() => validateCatalogForPublish(broken), /Ejercicio/);
});

test("la publicación rechaza preguntas mcq y bloques inválidos", () => {
  const brokenQuestion: CoreCourse = {
    ...fixture,
    questions: fixture.questions.map((question, index) =>
      index === 0 && question.type === "mcq"
        ? { ...question, options: ["Solo una"], answer: 0 }
        : question,
    ),
  };
  assert.throws(() => validateCatalogForPublish(brokenQuestion));

  const brokenBlock: CoreCourse = {
    ...fixture,
    lessons: fixture.lessons.map((lesson, index) =>
      index === 0 ? { ...lesson, content: [{ type: "p", text: "" }] } : lesson,
    ),
  };
  assert.throws(() => validateCatalogForPublish(brokenBlock));
});
