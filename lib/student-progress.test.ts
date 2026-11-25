import assert from "node:assert/strict";
import test from "node:test";

import {
  isProgressPayload,
  parseStoredProgress,
  progressPayloadTooLarge,
} from "./student-progress";

test("acepta el respaldo v5 y rechaza otras versiones o formas", () => {
  assert.equal(isProgressPayload({ version: 5 }), true);
  assert.equal(isProgressPayload({ version: 4 }), false);
  assert.equal(isProgressPayload(null), false);
  assert.equal(isProgressPayload([]), false);
  assert.equal(isProgressPayload("v5"), false);
});

test("acepta jsonb como objeto o como texto del pooler", () => {
  const payload = { version: 5, student: { externalKey: "x" } };
  assert.deepEqual(parseStoredProgress(payload), payload);
  assert.deepEqual(parseStoredProgress(JSON.stringify(payload)), payload);
});

test("limita el tamaño del progreso a 2 MB", () => {
  assert.equal(progressPayloadTooLarge({ version: 5, data: "x".repeat(10) }), false);
  assert.equal(
    progressPayloadTooLarge({ version: 5, data: "x".repeat(2_000_001) }),
    true,
  );
});
