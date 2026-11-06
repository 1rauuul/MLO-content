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

type CourseDoc = {
  schemaVersion: number;
  lessons: {
    id: string;
    topicId: string;
    exercises?: unknown;
    examples?: unknown;
    evaluations?: unknown;
    hash?: string;
  }[];
  topics: { id: string; unitId: string; title: string; summary: string; position: number }[];
  evaluations: { id: string; topicId: string; questionIds: string[]; exerciseIds: string[] }[];
  questions: { evaluationId: string }[];
  exercises: { id: string; topicId: string; lessonId?: string; example?: unknown }[];
  examples: { id: string; topicId: string; lessonId?: string }[];
};

const readCourse = (): CourseDoc =>
  JSON.parse(readText("valid-course-base-ref.json")) as CourseDoc;

type GroupDoc = {
  lessons: { id: string; topicId: string }[];
  topics: { id: string; unitId: string }[];
  questions: { evaluationId: string }[];
  exercises: { id: string; topicId: string; example?: unknown }[];
  examples: { id: string; topicId: string }[];
  evaluations: { id: string; topicId: string }[];
  additions: { lessonId: string; exercises?: unknown; examples?: unknown }[];
  units: unknown[];
};

const readGroup = (): GroupDoc =>
  JSON.parse(readText("valid-group-content.json")) as GroupDoc;

test("el curso tiene N lecciones, ejemplos, ejercicios y evaluaciones por subtema", () => {
  const doc = readCourse();
  assert.ok(doc.lessons.length >= 2);
  assert.ok(doc.examples.length >= 2);
  assert.ok(doc.exercises.length >= 2);
  assert.ok(doc.evaluations.length >= 2);
  assert.ok(doc.questions.length >= 2);
  for (const item of [
    ...doc.lessons,
    ...doc.examples,
    ...doc.exercises,
    ...doc.evaluations,
  ]) {
    assert.equal(item.topicId, "t1");
  }
});

test("el grupo cubre subtema propio y actividades sobre un subtema del curso", () => {
  const doc = readGroup();
  assert.ok(doc.units.length > 0);
  assert.ok(doc.topics.some((topic) => topic.id === "g-t1" && topic.unitId === "g-u1"));
  assert.ok(doc.lessons.some((lesson) => lesson.topicId === "g-t1"));
  assert.ok(doc.lessons.some((lesson) => lesson.topicId === "t1"));
  for (const collection of [doc.examples, doc.exercises, doc.evaluations]) {
    assert.ok(collection.some((item) => item.topicId === "g-t1"));
    assert.ok(collection.some((item) => item.topicId === "t1"));
  }
  assert.ok(doc.additions.some((addition) => addition.lessonId === "l1.1"));
});

test("una evaluación puede ser solo de preguntas", () => {
  const doc = readCourse() as CourseDoc & { hash: string };
  doc.evaluations[1].exerciseIds = [];
  const content: Record<string, unknown> = { ...doc };
  delete content.hash;
  doc.hash = hashValue(content);
  const result = validateRelease(doc);
  if (!result.ok) assert.fail(result.error);
});

test("rechaza una lección con actividades", () => {
  const doc = readCourse();
  doc.lessons[0].exercises = [];
  const result = validateRelease(doc);
  if (result.ok) assert.fail("la lección con actividades debía fallar.");
  assert.match(result.error, /no puede incluir exercises/);
});

test("rechaza lessonId en una actividad", () => {
  const doc = readCourse();
  doc.exercises[0].lessonId = "l1.1";
  const result = validateRelease(doc);
  if (result.ok) assert.fail("la actividad con lessonId debía fallar.");
  assert.match(result.error, /no admite lessonId/);
});

test("rechaza una evaluación con ejercicios de otro subtema", () => {
  const doc = readCourse();
  doc.topics.push({ id: "t2", unitId: "u1", title: "Otro", summary: "", position: 1 });
  doc.exercises[0].topicId = "t2";
  const result = validateRelease(doc);
  if (result.ok) assert.fail("la evaluación con ejercicios de otro subtema debía fallar.");
  assert.match(result.error, /pertenece a otro subtema/);
});

test("rechaza versiones v2 y v4", () => {
  for (const version of [2, 4]) {
    const doc = readCourse();
    doc.schemaVersion = version;
    const result = validateRelease(doc);
    if (result.ok) assert.fail(`schemaVersion ${version} debía fallar.`);
    assert.match(result.error, /schemaVersion incompatible/);
  }
});

test("rechaza un hash de release alterado", () => {
  const doc = readCourse() as CourseDoc & { hash: string };
  doc.hash = "0".repeat(64);
  const result = validateRelease(doc);
  if (result.ok) assert.fail("el hash de release alterado debía fallar.");
  assert.match(result.error, /hash del release no coincide/);
});

test("rechaza una pregunta de grupo sobre una evaluación del curso", () => {
  const doc = readGroup();
  doc.questions[0].evaluationId = "ev2";
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

test("los fixtures no llevan BOM, no tienen CR suelto y coinciden con fixtures.sha256.json", () => {
  assert.equal(manifest.contract, "mlo-v3");
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.algorithm, "sha256");
  assert.match(manifest.lineEndings, /LF/);

  for (const [file, expected] of Object.entries(manifest.files)) {
    const text = readText(file);
    assert.equal(text.charCodeAt(0), "{".charCodeAt(0), `${file}: no debe llevar BOM.`);
    assert.ok(!/\r(?!\n)/.test(text), `${file}: CR suelto.`);
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
