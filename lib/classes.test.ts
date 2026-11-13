import assert from "node:assert/strict";
import test from "node:test";

import { classPreviewPayload } from "./classes";

test("la vista previa de la clase incluye el curso asignado en el CMS", () => {
  const payload = classPreviewPayload({
    id: "c1",
    name: "Grupo A 2",
    teacher_name: "Ana Torres",
    course_key: "k7f3q",
    course_title: "Curso 2",
    published_version: null,
    published_hash: null,
    published_at: null,
  });

  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.class.name, "Grupo A 2");
  assert.deepEqual(payload.course, { catalogId: "k7f3q", title: "Curso 2" });
  assert.equal(payload.published, null);
});
