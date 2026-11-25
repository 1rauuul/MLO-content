import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmStudentPasswordReset,
  generateStudentRecoveryCode,
  isStudentRecoveryCode,
  requestStudentPasswordReset,
  STUDENT_RECOVERY_CODE_TTL_MINUTES,
  STUDENT_RECOVERY_MAX_ATTEMPTS,
  STUDENT_RECOVERY_MAX_REQUESTS,
  STUDENT_RECOVERY_WINDOW_MINUTES,
  studentRecoveryEmailContent,
} from "./student-recovery";

test("genera códigos de seis dígitos", () => {
  for (let index = 0; index < 20; index += 1) {
    assert.match(generateStudentRecoveryCode(), /^\d{6}$/);
  }
  assert.equal(isStudentRecoveryCode("123456"), true);
  assert.equal(isStudentRecoveryCode("012345"), true);
  assert.equal(isStudentRecoveryCode("12345"), false);
  assert.equal(isStudentRecoveryCode("abcdef"), false);
  assert.equal(isStudentRecoveryCode(" 123456 "), false);
});

test("expone los límites de la recuperación", () => {
  assert.equal(STUDENT_RECOVERY_CODE_TTL_MINUTES, 15);
  assert.equal(STUDENT_RECOVERY_MAX_REQUESTS, 3);
  assert.equal(STUDENT_RECOVERY_WINDOW_MINUTES, 15);
  assert.equal(STUDENT_RECOVERY_MAX_ATTEMPTS, 5);
});

test("el correo incluye código, usuario y vencimiento", () => {
  const content = studentRecoveryEmailContent({
    username: "valentina",
    code: "123456",
    expiresAt: new Date("2026-11-25T18:00:00.000Z"),
  });

  assert.match(content.subject, /contraseña/i);
  assert.match(content.text, /123456/);
  assert.match(content.text, /valentina/);
  assert.match(content.text, /Vence/);
  assert.match(content.html, /123456/);
  assert.match(content.html, /valentina/);
});

test("escapa el nombre en el HTML", () => {
  const content = studentRecoveryEmailContent({
    username: "<Ana & Co>",
    code: "123456",
    expiresAt: new Date("2026-11-25T18:00:00.000Z"),
  });

  assert.match(content.html, /&lt;Ana &amp; Co&gt;/);
  assert.doesNotMatch(content.html, /<Ana & Co>/);
});

test("rechaza un correo inválido sin consultar la base", async () => {
  await assert.doesNotReject(async () => {
    const result = await requestStudentPasswordReset("no-es-correo");
    assert.deepEqual(result, { ok: false, error: "invalid_email" });
  });
});

test("sin proveedor de correo responde email_unavailable", async () => {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM;
  delete process.env.EMAIL_PROVIDER_API_KEY;
  delete process.env.EMAIL_FROM;
  try {
    const result = await requestStudentPasswordReset("ana@escuela.mx");
    assert.deepEqual(result, { ok: false, error: "email_unavailable" });
  } finally {
    if (apiKey === undefined) delete process.env.EMAIL_PROVIDER_API_KEY;
    else process.env.EMAIL_PROVIDER_API_KEY = apiKey;
    if (from === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = from;
  }
});

test("rechaza códigos mal formados antes de consultar la base", async () => {
  const result = await confirmStudentPasswordReset({
    email: "ana@escuela.mx",
    code: "abc",
    password: "Secreto1!",
  });
  assert.deepEqual(result, { ok: false, error: "invalid_code" });
});

test("rechaza una contraseña débil antes de consultar la base", async () => {
  const result = await confirmStudentPasswordReset({
    email: "ana@escuela.mx",
    code: "123456",
    password: "debil",
  });
  assert.deepEqual(result, { ok: false, error: "password_invalid" });
});
