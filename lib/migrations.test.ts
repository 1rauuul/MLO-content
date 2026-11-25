import assert from "node:assert/strict";
import test from "node:test";

import { pendingMigrations } from "./migrations";

test("pendingMigrations ordena, descarta no SQL y omite las aplicadas", () => {
  assert.deepEqual(
    pendingMigrations(
      [
        "20261125000002_b.sql",
        "notas.txt",
        "20261125000001_a.sql",
        "20261125000003_c.sql",
      ],
      ["20261125000002_b.sql"],
    ),
    ["20261125000001_a.sql", "20261125000003_c.sql"],
  );
  assert.deepEqual(pendingMigrations(["b.sql", "a.sql"], []), ["a.sql", "b.sql"]);
  assert.deepEqual(pendingMigrations(["a.sql"], ["a.sql"]), []);
});
