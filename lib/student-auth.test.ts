import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, hashToken, newSessionToken, verifyPassword } from "./password";
import {
  bearerToken,
  isAcceptedStudentLoginPassword,
  isExternalKey,
  isValidStudentName,
  isValidStudentPassword,
  isValidStudentUsername,
  MAX_LOGIN_ATTEMPTS,
  normalizeStudentUsername,
  STUDENT_SESSION_DAYS,
  validateStudentRegistration,
} from "./student-auth";

test("normaliza el usuario a minúsculas y sin espacios", () => {
  assert.equal(normalizeStudentUsername("  Valentina  "), "valentina");
  assert.equal(isValidStudentUsername("Valentina"), true);
  assert.equal(isValidStudentUsername("ab"), false);
  assert.equal(isValidStudentUsername("con espacio"), false);
  assert.equal(isValidStudentUsername("a".repeat(33)), false);
});

test("exige la política fuerte de contraseña del CMS", () => {
  assert.equal(isValidStudentPassword("Abcdef1!"), true);
  assert.equal(isValidStudentPassword("Clave2026#"), true);
  assert.equal(isValidStudentPassword("abcdef1!"), false);
  assert.equal(isValidStudentPassword("ABCDEF1!"), false);
  assert.equal(isValidStudentPassword("Abcdefg!"), false);
  assert.equal(isValidStudentPassword("Abcdef12"), false);
  assert.equal(isValidStudentPassword("Abcdef1€"), false);
  assert.equal(isValidStudentPassword("a".repeat(129)), false);
});

test("el login solo exige una contraseña plausible, no la política nueva", () => {
  assert.equal(isAcceptedStudentLoginPassword("1234567a"), true);
  assert.equal(isAcceptedStudentLoginPassword("Abcdef1!"), true);
  assert.equal(isAcceptedStudentLoginPassword(""), false);
  assert.equal(isAcceptedStudentLoginPassword("a".repeat(129)), false);
});

test("valida el nombre visible, el correo y el externalKey", () => {
  assert.equal(isValidStudentName("A"), false);
  assert.equal(isValidStudentName("Ana"), true);
  assert.equal(
    isExternalKey("11111111-1111-4111-8111-111111111111"),
    true,
  );
  assert.equal(isExternalKey("no-es-uuid"), false);
});

test("valida el alta completa y devuelve el campo inválido", () => {
  const valid = {
    username: "valentina",
    password: "Secreto1!",
    displayName: "Valentina Ríos",
    email: "valentina@escuela.mx",
  };
  assert.equal(validateStudentRegistration(valid), null);
  assert.equal(
    validateStudentRegistration({ ...valid, username: "ab" }),
    "username_invalid",
  );
  assert.equal(
    validateStudentRegistration({ ...valid, password: "1234567a" }),
    "password_invalid",
  );
  assert.equal(
    validateStudentRegistration({ ...valid, displayName: "A" }),
    "display_name_invalid",
  );
  assert.equal(
    validateStudentRegistration({ ...valid, email: "" }),
    "email_invalid",
  );
  assert.equal(
    validateStudentRegistration({ ...valid, email: "no-es-correo" }),
    "email_invalid",
  );
});

test("scrypt guarda y verifica sin texto plano", async () => {
  const stored = await hashPassword("Secreto1!");
  assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("Secreto1!", stored), true);
  assert.equal(await verifyPassword("otra-clave", stored), false);
});

test("el token de sesión es aleatorio y se guarda hasheado", () => {
  const first = newSessionToken();
  const second = newSessionToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 32);
  assert.match(hashToken(first), /^[0-9a-f]{64}$/);
  assert.equal(MAX_LOGIN_ATTEMPTS, 10);
  assert.equal(STUDENT_SESSION_DAYS, 30);
});

test("lee solo el token Bearer", () => {
  assert.equal(
    bearerToken(
      new Request("https://example.test", {
        headers: { Authorization: "Bearer token-123" },
      }),
    ),
    "token-123",
  );
  assert.equal(bearerToken(new Request("https://example.test")), null);
  assert.equal(
    bearerToken(
      new Request("https://example.test", {
        headers: { Authorization: "Basic abc" },
      }),
    ),
    null,
  );
});
