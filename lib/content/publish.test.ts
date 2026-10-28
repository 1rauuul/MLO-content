import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { buildManifest, composeCatalog, releaseHash } from "./compose";
import { canonicalJson, hashValue } from "./hash";
import type { CoreCourse, CoreLesson } from "./model";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "scripts/fixtures/base-course.json"), "utf8"),
) as CoreCourse;

test("el JSON canónico ignora el orden de las claves", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.equal(hashValue({ a: [1, 2] }), hashValue({ a: [1, 2] }));
  assert.notEqual(hashValue({ a: 1 }), hashValue({ a: 2 }));
});

test("compone el core completo sin cambiar el contenido", () => {
  const catalog = composeCatalog("base", fixture);

  assert.equal(catalog.lessons.length, fixture.lessons.length);
  assert.deepEqual(
    catalog.lessons.map((lesson) => lesson.lessonId).sort((left, right) => left.localeCompare(right)),
    fixture.lessons
      .map((lesson) => lesson.content_id)
      .sort((left, right) => left.localeCompare(right)),
  );

  for (const payload of catalog.lessons) {
    const source = fixture.lessons.find((lesson) => lesson.content_id === payload.lessonId)!;
    assert.equal(payload.catalogId, "base");
    assert.equal(payload.hash, hashValue({ ...payload, hash: undefined }));
    assert.ok(payload.hash.length > 0);
    assert.deepEqual(payload.lesson.content, source.content);
    assert.equal(payload.lesson.unitId, payload.unit.id);
  }

  const lesson12 = catalog.lessons.find((lesson) => lesson.lessonId === "l1.2")!;
  assert.ok(lesson12.evaluation);
  assert.ok(lesson12.exercises.length > 0);
  assert.ok(lesson12.questions.length > 0);
  assert.ok(lesson12.examples.some((example) => example.id === "exA1.2"));
  assert.ok(lesson12.exercises.some((exercise) => exercise.id === "ord1.2" && exercise.example));

  const lesson11 = catalog.lessons.find((lesson) => lesson.lessonId === "l1.1")!;
  assert.equal(lesson11.evaluation, null);
  assert.equal(lesson11.questions.length, 0);
});

test("prefija los ids con la clave del curso y deja intacto el core", () => {
  const ownLesson: CoreLesson = {
    ...fixture.lessons[0],
    content_id: "l1.5",
    code: "1.5",
    title: "Adición del maestro",
    position: 99,
  };
  const catalog = composeCatalog("abcde", {
    ...fixture,
    lessons: [...fixture.lessons, ownLesson],
  });
  const ids = new Set(catalog.lessons.map((lesson) => lesson.lessonId));

  assert.ok(ids.has("abcde-l1.1"));
  assert.ok(ids.has("abcde-l1.5"));

  const payload = catalog.lessons.find((lesson) => lesson.lessonId === "abcde-l1.5")!;
  assert.equal(payload.unit.id, "abcde-u1");
  assert.deepEqual(payload.lesson.content, ownLesson.content);

  const core = catalog.lessons.find((lesson) => lesson.lessonId === "abcde-l1.2")!;
  assert.equal(core.evaluation?.id, "abcde-ev1.2");
  assert.ok(core.exercises.some((exercise) => exercise.id === "abcde-ord1.2"));
  assert.ok(core.examples.some((example) => example.id === "abcde-exA1.2"));
  assert.equal(core.questions[0]?.evaluationId, "abcde-ev1.2");
  assert.ok(core.questions[0]?.question.id.startsWith("abcde-"));
});

test("el manifest es estable y cambia solo si cambia el contenido", () => {
  const catalog = composeCatalog("base", fixture);
  const manifest = buildManifest(catalog, 1, "2026-10-27T00:00:00.000Z");

  assert.equal(manifest.version, "1");
  assert.equal(manifest.hash, releaseHash(catalog));
  assert.equal(manifest.lessons.length, catalog.lessons.length);
  assert.ok(manifest.lessons.every((entry) => entry.hash.length > 0));

  const reordered = composeCatalog("base", {
    ...fixture,
    lessons: [...fixture.lessons].reverse(),
  });
  assert.equal(releaseHash(reordered), manifest.hash);

  const changed = composeCatalog("base", {
    ...fixture,
    lessons: fixture.lessons.map((lesson, index) =>
      index === 0 ? { ...lesson, title: `${lesson.title} (editada)` } : lesson,
    ),
  });
  assert.notEqual(releaseHash(changed), manifest.hash);
});

test("serializa los campos vacíos de forma explícita", () => {
  const empty: CoreCourse = {
    schemaVersion: 2,
    title: "Curso vacío",
    units: [
      {
        content_id: "u1",
        number: 1,
        title: "Unidad",
        description: "",
        difficulty: "Fundamental",
        color: "blue",
        position: 0,
      },
    ],
    lessons: [
      {
        content_id: "l1.1",
        unit_content_id: "u1",
        code: "1.1",
        title: "Lección",
        eyebrow: "",
        body: "",
        code_sample: "",
        context_title: "",
        context_body: "",
        synthesis: [],
        content: [{ type: "p", text: "Hola" }],
        position: 0,
      },
    ],
    evaluations: [],
    exercises: [],
    examples: [],
    questions: [],
  };

  const payload = composeCatalog("base", empty).lessons[0];
  assert.equal(payload.evaluation, null);
  assert.deepEqual(payload.exercises, []);
  assert.deepEqual(payload.examples, []);
  assert.deepEqual(payload.questions, []);
  assert.equal(payload.lesson.codeSample, "");
  assert.equal(payload.lesson.contextTitle, "");
  assert.equal(payload.lesson.contextBody, "");
  assert.deepEqual(payload.lesson.synthesis, []);

  const json = JSON.stringify(payload);
  for (const field of ["codeSample", "contextTitle", "contextBody", "synthesis"]) {
    assert.ok(json.includes(`"${field}"`), `falta ${field}`);
  }
});

test("rechaza ids repetidos y evaluaciones vacías", () => {
  assert.throws(() =>
    composeCatalog("base", {
      ...fixture,
      lessons: [...fixture.lessons, { ...fixture.lessons[0], position: 99 }],
    }),
  );

  assert.throws(() =>
    composeCatalog("base", {
      ...fixture,
      questions: [],
    }),
  );
});
