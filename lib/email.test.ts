import assert from "node:assert/strict";
import test from "node:test";

import { emailConfigured, normalizeEmail } from "./email";

test("normaliza correos válidos y rechaza formatos incompletos", () => {
  assert.equal(normalizeEmail(" A@B.CO "), "a@b.co");
  assert.equal(normalizeEmail("alumno+tag@universidad.edu.mx"), "alumno+tag@universidad.edu.mx");
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail("sin-arroba.example.com"), null);
  assert.equal(normalizeEmail("a b@correo.com"), null);
  assert.equal(normalizeEmail(""), null);
});

test("detecta si el proveedor de correo está configurado", () => {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM;
  try {
    delete process.env.EMAIL_PROVIDER_API_KEY;
    delete process.env.EMAIL_FROM;
    assert.equal(emailConfigured(), false);

    process.env.EMAIL_PROVIDER_API_KEY = "re_test";
    assert.equal(emailConfigured(), false);

    process.env.EMAIL_FROM = "MLO <no-reply@test.dev>";
    assert.equal(emailConfigured(), true);
  } finally {
    if (apiKey === undefined) delete process.env.EMAIL_PROVIDER_API_KEY;
    else process.env.EMAIL_PROVIDER_API_KEY = apiKey;
    if (from === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = from;
  }
});
