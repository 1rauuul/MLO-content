import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { db } from "../lib/db";
import { migrationsUpTo, pendingMigrations } from "../lib/migrations";

const DIR = "supabase/migrations";

async function sqlFiles(): Promise<string[]> {
  return (await readdir(DIR)).filter((file) => file.endsWith(".sql"));
}

async function bootstrap(): Promise<void> {
  await db()`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`;
}

async function applied(): Promise<string[]> {
  const rows = await db()<{ filename: string }[]>`select filename from schema_migrations`;
  return rows.map((row) => row.filename);
}

async function pending(): Promise<string[]> {
  await bootstrap();
  return pendingMigrations(await sqlFiles(), await applied());
}

async function close(): Promise<void> {
  try {
    await db().end({ timeout: 5 });
  } catch {
    // Sin conexión abierta (por ejemplo, falta DATABASE_URL).
  }
}

async function main(): Promise<void> {
  const flag = process.argv[2];
  if (flag && flag !== "--baseline" && flag !== "--status") {
    console.error(
      `Opción desconocida: ${flag}\nUso: npm run db:migrate [-- --baseline [hasta]|--status]`,
    );
    process.exitCode = 1;
    return;
  }

  if (flag === "--status") {
    if (process.argv[3]) {
      console.error("--status no acepta argumentos.");
      process.exitCode = 1;
      return;
    }
    const list = await pending();
    console.log(
      list.length ? `Pendientes (${list.length}):\n${list.join("\n")}` : "No hay migraciones pendientes.",
    );
    return;
  }

  if (flag === "--baseline") {
    const [schema] = await db()<{ courses: string | null }[]>`
      select to_regclass('public.courses') as courses`;
    if (!schema?.courses) {
      console.error(
        "La base no tiene el esquema (falta courses). No uses --baseline en una base nueva: usa npm run db:migrate.",
      );
      process.exitCode = 1;
      return;
    }
    const cutoff = process.argv[3];
    if (!cutoff) {
      console.error(
        "Indica el corte: npm run db:migrate -- --baseline <ultima-migracion-aplicada>.sql",
      );
      process.exitCode = 1;
      return;
    }
    await bootstrap();
    const all = await sqlFiles();
    if (!all.includes(cutoff)) {
      console.error(`No existe la migración de corte: ${cutoff}`);
      process.exitCode = 1;
      return;
    }
    const list = migrationsUpTo(all, cutoff);
    for (const file of list) {
      await db()`insert into schema_migrations (filename) values (${file}) on conflict do nothing`;
    }
    console.log(`Baseline registrado: ${list.length} archivos marcados como aplicados.`);
    return;
  }

  for (const file of await pending()) {
    const source = await readFile(join(DIR, file), "utf8");
    // Como en scripts/apply-schema.ts: postgres.js reserva la transacción y los
    // BEGIN/COMMIT del archivo rompen el pooler.
    const statement = source
      .replace(/^\s*begin\s*;\s*$/gim, "")
      .replace(/^\s*commit\s*;\s*$/gim, "");
    try {
      await db().begin(async (tx) => {
        await tx.unsafe(statement);
        await tx`insert into schema_migrations (filename) values (${file})`;
      });
      console.log(`Aplicada: ${file}`);
    } catch (error) {
      console.error(`Migración fallida: ${file}`);
      throw error;
    }
  }
  console.log("Migraciones al día.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(close);
