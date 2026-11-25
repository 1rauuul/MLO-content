import assert from "node:assert/strict";
import test from "node:test";

import { migrationsUpTo, pendingMigrations } from "./migrations";

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

test("migrationsUpTo corta el baseline antes de las migraciones nuevas", () => {
  const files = [
    "20261125000005_recovery_delivery.sql",
    "20261125000006_auth_rate_limits_class_join.sql",
    "20261126000000_schema_migrations.sql",
    "notas.txt",
  ];
  assert.deepEqual(migrationsUpTo(files, "20261125000005_recovery_delivery.sql"), [
    "20261125000005_recovery_delivery.sql",
  ]);
});
