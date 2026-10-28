import { db } from "../lib/db";

async function main() {
  const file = process.argv[2] ?? "supabase/migrations/20261027000000_init.sql";
  await db().file(file);
  console.log(`Esquema aplicado: ${file}`);
  await db().end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
