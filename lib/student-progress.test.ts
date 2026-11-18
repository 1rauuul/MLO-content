import assert from "node:assert/strict";
import test from "node:test";

import { isProgressPayload, progressPayloadTooLarge } from "./student-progress";

test("acepta el respaldo v5 y rechaza otras versiones o formas", () => {
  assert.equal(isProgressPayload({ version: 5 }), true);
  assert.equal(isProgressPayload({ version: 4 }), false);
  assert.equal(isProgressPayload(null), false);
  assert.equal(isProgressPayload([]), false);
  assert.equal(isProgressPayload("v5"), false);
});

test("limita el tamaño del progreso a 2 MB", () => {
  assert.equal(progressPayloadTooLarge({ version: 5, data: "x".repeat(10) }), false);
  assert.equal(
    progressPayloadTooLarge({ version: 5, data: "x".repeat(2_000_001) }),
    true,
  );
});
