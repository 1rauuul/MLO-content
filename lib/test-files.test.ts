import assert from "node:assert/strict";
import test from "node:test";

import { discoverUnitTests } from "../scripts/test-files";

test("discoverUnitTests incluye tests de lib y excluye los de base", () => {
  const files = discoverUnitTests(process.cwd());
  assert.ok(files.includes("lib/navigation.test.ts"));
  assert.ok(files.includes("lib/test-files.test.ts"));
  assert.ok(files.every((file) => file.endsWith(".test.ts")));
  assert.ok(files.every((file) => !file.endsWith(".db.test.ts")));
  assert.ok(!files.includes("lib/import-base.db.test.ts"));
});
