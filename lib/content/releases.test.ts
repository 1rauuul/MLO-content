import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogManifest } from "./compose";
import type { PublishedLessonPayload } from "./serialize";
import { lessonFrom, manifestFrom, type ReleaseSnapshot } from "./releases";

const manifest: CatalogManifest = {
  schemaVersion: 2,
  catalogId: "abcde",
  title: "Curso",
  version: "1",
  hash: "release-hash",
  publishedAt: "2026-10-27T00:00:00.000Z",
  lessons: [{ lessonId: "abcde-l1.1", unitId: "abcde-u1", hash: "lesson-hash" }],
};

const lesson = {
  schemaVersion: 2,
  catalogId: "abcde",
  lessonId: "abcde-l1.1",
  hash: "lesson-hash",
} as PublishedLessonPayload;

const snapshot: ReleaseSnapshot = {
  manifest,
  lessons: { "abcde-l1.1": lesson },
};

test("devuelve el manifest solo si el catálogo coincide", () => {
  assert.equal(manifestFrom(snapshot, "abcde"), manifest);
  assert.equal(manifestFrom(snapshot, "otro"), null);
  assert.equal(manifestFrom(null, "abcde"), null);
});

test("devuelve solo lecciones del manifest actual", () => {
  assert.equal(lessonFrom(snapshot, "abcde", "abcde-l1.1"), lesson);
  assert.equal(lessonFrom(snapshot, "abcde", "abcde-l1.2"), null);
  assert.equal(lessonFrom(snapshot, "otro", "abcde-l1.1"), null);

  const orphan = {
    ...snapshot,
    lessons: { ...snapshot.lessons, "abcde-l1.2": { ...lesson, lessonId: "abcde-l1.2" } },
  };
  assert.equal(lessonFrom(orphan, "abcde", "abcde-l1.2"), null);
});

test("rechaza un payload de otro catálogo", () => {
  const other = {
    ...snapshot,
    lessons: { "abcde-l1.1": { ...lesson, catalogId: "otro" } },
  };
  assert.equal(lessonFrom(other, "abcde", "abcde-l1.1"), null);
});
