import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildClassSnapshot,
  classReleaseHash,
  compareLessonCodes,
  extraLabel,
  parseExtraPayload,
  type ClassReleaseSnapshot,
  type ExtraForRelease,
} from "./classes";

const klass = { id: "class-1", name: "Grupo A", teacherName: "Ana" };

function extra(overrides: Partial<ExtraForRelease> & { id: string }): ExtraForRelease {
  return {
    type: "lesson",
    payload: { title: "", blocks: [{ type: "p", text: "Hola" }] },
    lesson_content_id: "l1.2",
    lesson_code: "1.2",
    lesson_position: 2,
    ...overrides,
  };
}

test("agrupa los extras por lección y ordena por código", () => {
  const extras = [
    extra({ id: "b", lesson_content_id: "l1.2", lesson_code: "1.2", lesson_position: 2 }),
    extra({ id: "a", lesson_content_id: "l1.1", lesson_code: "1.1", lesson_position: 1 }),
    extra({ id: "c", lesson_content_id: "l1.2", lesson_code: "1.2", lesson_position: 2 }),
  ];

  const snapshot = buildClassSnapshot({
    class: klass,
    version: 1,
    publishedAt: "2026-10-27T00:00:00.000Z",
    extras,
  });

  assert.deepEqual(
    snapshot.lessons.map((lesson) => lesson.lessonId),
    ["l1.1", "l1.2"],
  );
  assert.deepEqual(
    snapshot.lessons[1].extras.map((item) => item.id),
    ["b", "c"],
  );
  assert.equal(snapshot.hash, classReleaseHash(klass, extras));
  assert.equal(snapshot.schemaVersion, 2);
});

test("el hash no cambia por el orden de entrada ni por la versión", () => {
  const first = extra({ id: "a" });
  const second = extra({ id: "b", lesson_content_id: "l1.3", lesson_code: "1.3" });

  const one = buildClassSnapshot({
    class: klass,
    version: 1,
    publishedAt: "2026-10-27T00:00:00.000Z",
    extras: [first, second],
  });
  const two = buildClassSnapshot({
    class: klass,
    version: 7,
    publishedAt: "2027-01-01T00:00:00.000Z",
    extras: [second, first],
  });

  assert.equal(one.hash, two.hash);
});

test("el hash cambia si cambia el nombre de la clase o el contenido", () => {
  const extras = [extra({ id: "a" })];
  const base = classReleaseHash(klass, extras);

  assert.notEqual(base, classReleaseHash({ ...klass, name: "Grupo B" }, extras));
  assert.notEqual(
    base,
    classReleaseHash(klass, [
      extra({
        id: "a",
        payload: { title: "", blocks: [{ type: "p", text: "Otro texto" }] },
      }),
    ]),
  );
});

test("una clase sin contenido produce un snapshot vacío estable", () => {
  const snapshot = buildClassSnapshot({
    class: klass,
    version: 1,
    publishedAt: "2026-10-27T00:00:00.000Z",
    extras: [],
  });

  assert.deepEqual(snapshot.lessons, []);
  assert.equal(snapshot.hash, classReleaseHash(klass, []));
});

test("el mismo contenido asignado a dos clases entra en cada snapshot", () => {
  const shared = extra({ id: "shared" });
  const a = buildClassSnapshot({
    class: { id: "a", name: "A", teacherName: "Ana" },
    version: 1,
    publishedAt: "2026-10-27T00:00:00.000Z",
    extras: [shared],
  });
  const b = buildClassSnapshot({
    class: { id: "b", name: "B", teacherName: "Ana" },
    version: 1,
    publishedAt: "2026-10-27T00:00:00.000Z",
    extras: [shared],
  });

  assert.equal(a.lessons[0].extras[0].id, "shared");
  assert.equal(b.lessons[0].extras[0].id, "shared");
  assert.notEqual(a.hash, b.hash);
});

test("valida ejercicios, ejemplos y bloques con las reglas existentes", () => {
  const exercise = parseExtraPayload("exercise", {
    type: "order",
    prompt: "Ordena",
    instructions: "",
    correctOrder: ["uno", "dos"],
    config: {},
    explanation: "",
  });
  assert.ok("value" in exercise);

  const badOrder = parseExtraPayload("exercise", {
    type: "order",
    prompt: "Ordena",
    instructions: "",
    correctOrder: ["uno"],
    config: {},
    explanation: "",
  });
  assert.ok("error" in badOrder);

  const example = parseExtraPayload("example", {
    type: "match",
    title: "Ejemplo",
    prompt: "Relaciona",
    config: { pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] },
    steps: [{ text: "Paso", why: "Porque sí" }],
    hints: [],
    explanation: "",
  });
  assert.ok("value" in example);

  const orderExample = parseExtraPayload("example", {
    type: "order",
    title: "Ejemplo",
    prompt: "Relaciona",
    config: {},
    steps: [{ text: "Paso", why: "Porque sí" }],
    hints: [],
    explanation: "",
  });
  assert.ok("error" in orderExample);

  const lesson = parseExtraPayload("lesson", {
    title: "Contexto",
    blocks: [{ type: "p", text: "Texto" }],
  });
  assert.ok("value" in lesson);

  const emptyLesson = parseExtraPayload("lesson", { title: "", blocks: [] });
  assert.ok("error" in emptyLesson);
});

test("la etiqueta corta usa el título o el enunciado", () => {
  assert.equal(extraLabel("lesson", { title: "Contexto", blocks: [] }), "Contexto");
  assert.equal(extraLabel("lesson", { title: "", blocks: [] }), "Bloques de contenido");
  assert.equal(extraLabel("exercise", { prompt: "Ordena esto" }), "Ordena esto");
  assert.equal(extraLabel("example", { title: "Ejemplo 1" }), "Ejemplo 1");
});

test("ordena códigos de lección por número, no por texto", () => {
  assert.ok(compareLessonCodes("1.2", "1.10") < 0);
  assert.ok(compareLessonCodes("2.1", "1.9") > 0);
  assert.equal(compareLessonCodes("1.2", "1.2"), 0);
});

test("el fixture del contrato de clase es válido", () => {
  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "scripts/fixtures/class-release.json"), "utf8"),
  ) as ClassReleaseSnapshot;

  assert.equal(fixture.schemaVersion, 2);
  assert.ok(fixture.class.id && fixture.class.name && fixture.class.teacherName);
  assert.equal(fixture.hash.length, 64);
  assert.ok(fixture.lessons.length > 0);

  for (const lesson of fixture.lessons) {
    assert.ok(lesson.lessonId.startsWith("l"));
    assert.ok(lesson.code);
    assert.ok(lesson.extras.length > 0);
    for (const extra of lesson.extras) {
      const parsed = parseExtraPayload(extra.type, extra.content, { strict: true });
      assert.ok("value" in parsed);
    }
  }
});
