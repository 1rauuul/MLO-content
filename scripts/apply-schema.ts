import { readFile } from "node:fs/promises";

import { db } from "../lib/db";

async function main() {
  const file = process.argv[2] ?? "supabase/migrations/20261027000000_init.sql";
  const source = await readFile(file, "utf8");
  // Las migraciones pueden declarar BEGIN/COMMIT. El pooler de Supabase exige
  // que la transacción se reserve con postgres.js, así que los envolvemos aquí.
  const statement = source
    .replace(/^\s*begin\s*;\s*$/gim, "")
    .replace(/^\s*commit\s*;\s*$/gim, "");
  await db().begin(async (tx) => {
    await tx.unsafe(statement);
  });
  console.log(`Esquema aplicado: ${file}`);
  await db().end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
