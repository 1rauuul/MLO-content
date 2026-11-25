import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEmail } from "./email";

test("normaliza correos válidos y rechaza formatos incompletos", () => {
  assert.equal(normalizeEmail(" A@B.CO "), "a@b.co");
  assert.equal(normalizeEmail("alumno+tag@universidad.edu.mx"), "alumno+tag@universidad.edu.mx");
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail("sin-arroba.example.com"), null);
  assert.equal(normalizeEmail("a b@correo.com"), null);
  assert.equal(normalizeEmail(""), null);
});
