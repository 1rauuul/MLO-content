import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { validateRelease } from "./contract-v3";
import { hashValue } from "./hash";

const fixtures = join(process.cwd(), "docs/contracts/fixtures");
const readText = (file: string) => readFileSync(join(fixtures, file), "utf8");
const readJson = (file: string): unknown => JSON.parse(readText(file));

const VALID = [
  "valid-course-empty.json",
  "valid-course-base-ref.json",
  "valid-group-content.json",
];

const INVALID: { file: string; reason: RegExp }[] = [
  { file: "invalid-version.json", reason: /schemaVersion incompatible/ },
  { file: "invalid-duplicate-id.json", reason: /Id duplicado/ },
  { file: "invalid-hash.json", reason: /hash del release no coincide/ },
  { file: "invalid-hierarchy.json", reason: /subtema inexistente/ },
  { file: "invalid-activity.json", reason: /respuesta fuera de rango/ },
];

type Manifest = {
  contract: string;
  schemaVersion: number;
  algorithm: string;
  lineEndings: string;
  aggregate: string;
  files: Record<string, string>;
};

const manifest = JSON.parse(readText("fixtures.sha256.json")) as Manifest;

test("los fixtures válidos pasan el esquema v3", () => {
  for (const file of VALID) {
    const result = validateRelease(readJson(file));
    if (!result.ok) assert.fail(`${file}: ${result.error}`);
  }
});

test("los fixtures inválidos fallan por el motivo esperado", () => {
  for (const { file, reason } of INVALID) {
    const result = validateRelease(readJson(file));
    if (result.ok) assert.fail(`${file} debía fallar y pasó.`);
    assert.match(result.error, reason, file);
  }
});

test("rechaza un hash de lección alterado", () => {
  const doc = readJson("valid-course-base-ref.json") as { lessons: { hash: string }[] };
  doc.lessons[0].hash = "0".repeat(64);
  const result = validateRelease(doc);
  if (result.ok) assert.fail("el hash de lección alterado debía fallar.");
  assert.match(result.error, /Lección l1\.1: hash no coincide/);
});

type GroupDoc = {
  lessons: { id: string; hash: string }[];
  questions: { evaluationId: string }[];
  exercises: { lessonId: string; example?: unknown }[];
  additions: { lessonId: string; exercises?: unknown; examples?: unknown }[];
  units: unknown[];
  topics: unknown[];
  evaluations: unknown[];
  examples: unknown[];
};

const readGroup = (): GroupDoc =>
  JSON.parse(readText("valid-group-content.json")) as GroupDoc;

test("el fixture de grupo cubre el alcance ampliado", () => {
  const doc = readGroup();
  for (const collection of [
    doc.units,
    doc.topics,
    doc.lessons,
    doc.evaluations,
    doc.questions,
    doc.exercises,
    doc.examples,
    doc.additions,
  ]) {
    assert.ok(collection.length > 0);
  }
  assert.ok(doc.additions.some((addition) => addition.lessonId === "l1.1"));
  assert.ok(doc.exercises.some((exercise) => exercise.lessonId === "l1.1"));
});

test("rechaza una pregunta de grupo sobre una evaluación del curso", () => {
  const doc = readGroup();
  doc.questions[0].evaluationId = "ev1.2";
  const result = validateRelease(doc);
  if (result.ok) assert.fail("la pregunta debía rechazarse.");
  assert.match(result.error, /evaluación inexistente/);
});

test("rechaza ejercicios y ejemplos dentro de additions", () => {
  for (const field of ["exercises", "examples"] as const) {
    const doc = readGroup();
    doc.additions[0][field] = [];
    const result = validateRelease(doc);
    if (result.ok) assert.fail(`additions con ${field} debía fallar.`);
    assert.match(result.error, new RegExp(`no puede incluir ${field}`));
  }
});

test("rechaza una adición sobre una lección propia del grupo", () => {
  const doc = readGroup();
  doc.additions[0].lessonId = "g-l1";
  const result = validateRelease(doc);
  if (result.ok) assert.fail("la adición sobre una lección propia debía fallar.");
  assert.match(result.error, /lección propia del grupo/);
});

test("rechaza un ejercicio sin example", () => {
  const doc = readGroup();
  delete doc.exercises[0].example;
  const result = validateRelease(doc);
  if (result.ok) assert.fail("el ejercicio sin example debía fallar.");
  assert.match(result.error, /example: es obligatorio/);
});

test("rechaza un hash de lección de grupo alterado", () => {
  const doc = readGroup();
  doc.lessons[0].hash = "0".repeat(64);
  const result = validateRelease(doc);
  if (result.ok) assert.fail("el hash de lección del grupo debía fallar.");
  assert.match(result.error, /Lección g-l1: hash no coincide/);
});

test("los fixtures usan LF, no llevan BOM y coinciden con fixtures.sha256.json", () => {
  assert.equal(manifest.contract, "mlo-v3");
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.algorithm, "sha256");
  assert.match(manifest.lineEndings, /LF/);

  for (const [file, expected] of Object.entries(manifest.files)) {
    const text = readText(file);
    assert.equal(text.charCodeAt(0), "{".charCodeAt(0), `${file}: no debe llevar BOM.`);
    assert.ok(!text.includes("\r"), `${file}: debe usar LF.`);
    const actual = createHash("sha256")
      .update(text.replace(/\r\n/g, "\n"), "utf8")
      .digest("hex");
    assert.equal(actual, expected, file);
  }

  assert.equal(manifest.aggregate, hashValue(manifest.files));
});

test("fixtures.sha256.json lista todos los fixtures y ninguno extra", () => {
  const onDisk = readdirSync(fixtures)
    .filter((file) => file.endsWith(".json") && file !== "fixtures.sha256.json")
    .sort();
  assert.deepEqual(Object.keys(manifest.files).sort(), onDisk);
});
