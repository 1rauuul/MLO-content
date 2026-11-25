import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  validatePassword,
} from "./password-policy";

test("acepta contraseñas con mayúscula, minúscula, número y símbolo", () => {
  assert.equal(validatePassword("Abcdef1!").valid, true);
  assert.equal(validatePassword("Clave2026#").valid, true);
  assert.equal(validatePassword("A1!aaaaa").valid, true);
});

test("rechaza cada requisito que falta", () => {
  assert.deepEqual(validatePassword("abcdef1!").unmet, ["uppercase"]);
  assert.deepEqual(validatePassword("ABCDEF1!").unmet, ["lowercase"]);
  assert.deepEqual(validatePassword("Abcdefg!").unmet, ["number"]);
  assert.deepEqual(validatePassword("Abcdef12").unmet, ["special"]);
  assert.deepEqual(validatePassword("Ab1!").unmet, ["length"]);
});

test("respeta el mínimo y el máximo de longitud", () => {
  const base = "Aa1!";
  const max = base + "x".repeat(PASSWORD_MAX_LENGTH - base.length);
  const over = base + "x".repeat(PASSWORD_MAX_LENGTH - base.length + 1);
  assert.equal(max.length, PASSWORD_MAX_LENGTH);
  assert.equal(validatePassword(max).valid, true);
  assert.equal(validatePassword(over).valid, false);
  assert.deepEqual(validatePassword("Aa1!").unmet, ["length"]);
  assert.equal(PASSWORD_MIN_LENGTH, 8);
});

test("expone los cinco requisitos con etiquetas", () => {
  assert.deepEqual(
    PASSWORD_REQUIREMENTS.map((requirement) => requirement.id),
    ["length", "uppercase", "lowercase", "number", "special"],
  );
  assert.ok(PASSWORD_REQUIREMENTS.every((requirement) => requirement.label.length > 0));
});
