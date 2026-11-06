import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { validateRelease } from "./contract-v3";
import { buildX03Fixture } from "./x03-fixtures";
import {
  backfillTopics,
  editorCourseIds,
  reorderNeighbor,
  selectPrimaryEvaluations,
  topicContentId,
} from "./x03";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "docs/contracts/fixtures/x03/manifest-topics.json"), "utf8"),
) as unknown;

test("el fixture x03 se genera con el builder real", () => {
  assert.deepEqual(fixture, buildX03Fixture());
});

test("el release x03 tiene jerarquía, N evaluaciones y exerciseIds", () => {
  const release = buildX03Fixture();
  const result = validateRelease(release);
  if (!result.ok) assert.fail(result.error);

  assert.equal((release.units as unknown[]).length, 1);
  assert.equal((release.topics as unknown[]).length, 1);
  assert.equal((release.lessons as unknown[]).length, 2);
  assert.equal((release.examples as unknown[]).length, 2);
  assert.equal((release.exercises as unknown[]).length, 2);
  assert.equal((release.evaluations as unknown[]).length, 2);
  assert.equal((release.questions as unknown[]).length, 2);

  const evaluations = release.evaluations as {
    id: string;
    topicId: string;
    questionIds: string[];
    exerciseIds: string[];
  }[];
  assert.deepEqual(
    evaluations.map((evaluation) => evaluation.id),
    ["demo-ev1", "demo-ev2"],
  );
  assert.ok(evaluations.every((evaluation) => evaluation.topicId === "demo-t1"));
  assert.deepEqual(evaluations[0].exerciseIds, ["demo-ord1"]);
  assert.deepEqual(evaluations[1].exerciseIds, ["demo-ord1", "demo-fill1"]);
  assert.deepEqual(evaluations[0].questionIds, ["demo-q1"]);
  assert.deepEqual(evaluations[1].questionIds, ["demo-q2"]);
});

test("una evaluación solo de preguntas publica exerciseIds vacío y sigue siendo válida", () => {
  const release = buildX03Fixture({ pureQuestions: true });
  const result = validateRelease(release);
  if (!result.ok) assert.fail(result.error);

  const evaluations = release.evaluations as {
    id: string;
    questionIds: string[];
    exerciseIds: string[];
  }[];
  assert.deepEqual(
    evaluations.map((evaluation) => evaluation.id),
    ["demo-ev1", "demo-ev2"],
  );
  assert.deepEqual(evaluations[0].exerciseIds, []);
  assert.deepEqual(evaluations[0].questionIds, ["demo-q1"]);
  assert.deepEqual(evaluations[1].exerciseIds, ["demo-ord1", "demo-fill1"]);
});

test("el orden del release sigue position, code e id", () => {
  const release = buildX03Fixture();
  assert.deepEqual(
    (release.lessons as { id: string }[]).map((lesson) => lesson.id),
    ["demo-l1.1", "demo-l1.2"],
  );
  assert.deepEqual(
    (release.examples as { id: string }[]).map((example) => example.id),
    ["demo-ex1", "demo-ex2"],
  );
  assert.deepEqual(
    (release.exercises as { id: string }[]).map((exercise) => exercise.id),
    ["demo-ord1", "demo-fill1"],
  );
});

test("backfill: un subtema por lección con posición determinista", () => {
  const lessons = [
    { content_id: "l1.2", unit_content_id: "u1", title: "Dos", position: 1 },
    { content_id: "l1.1", unit_content_id: "u1", title: "Uno", position: 0 },
  ];
  const topics = backfillTopics(lessons);

  assert.equal(topics.length, lessons.length);
  assert.deepEqual(
    topics.map((topic) => topic.content_id),
    ["t-l1.2", "t-l1.1"],
  );
  assert.equal(topicContentId("l1.1"), "t-l1.1");
  assert.deepEqual(
    topics.map((topic) => topic.position),
    [1, 0],
  );
});

test("v2 elige una evaluación primaria por lección", () => {
  const primary = selectPrimaryEvaluations([
    { content_id: "ev-b", lesson_content_id: "l1", position: 1 },
    { content_id: "ev-a", lesson_content_id: "l1", position: 0 },
    { content_id: "ev-c", lesson_content_id: "l2", position: 0 },
  ]);

  assert.deepEqual(
    primary.map((evaluation) => evaluation.content_id),
    ["ev-a", "ev-c"],
  );
});

test("el editor de un grupo no compone con el curso base", () => {
  assert.deepEqual(editorCourseIds(true, "group-course", "base-id"), [
    "group-course",
  ]);
  assert.deepEqual(editorCourseIds(false, "course", "base-id"), [
    "base-id",
    "course",
  ]);
  assert.deepEqual(editorCourseIds(false, "course", null), ["course"]);
  assert.deepEqual(editorCourseIds(false, "course", "course"), ["course"]);
});

test("reordenar devuelve el vecino correcto y no inventa filas", () => {
  const rows = [
    { id: "b", position: 1 },
    { id: "a", position: 0 },
    { id: "c", position: 2 },
  ];
  assert.deepEqual(reorderNeighbor(rows, "a", "down"), {
    current: { id: "a", position: 0 },
    neighbor: { id: "b", position: 1 },
  });
  assert.deepEqual(reorderNeighbor(rows, "b", "up"), {
    current: { id: "b", position: 1 },
    neighbor: { id: "a", position: 0 },
  });
  assert.equal(reorderNeighbor(rows, "a", "up"), null);
  assert.equal(reorderNeighbor(rows, "c", "down"), null);
  assert.equal(reorderNeighbor(rows, "missing", "up"), null);
});
