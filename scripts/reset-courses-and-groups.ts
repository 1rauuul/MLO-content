import { readFile } from "node:fs/promises";

import { db } from "../lib/db";

async function main() {
  if (process.env.MLO_CONFIRM_RESET !== "yes") {
    console.error(
      "Negado. Este script borra todos los cursos (excepto el base), los grupos y el progreso.\n" +
        "Define MLO_CONFIRM_RESET=yes para ejecutarlo en una base de pruebas.",
    );
    process.exit(1);
  }

  const source = await readFile("scripts/reset-courses-and-groups.sql", "utf8");
  await db().begin(async (tx) => {
    await tx.unsafe(source);
  });
  console.log("Base de pruebas reiniciada: cursos no base, grupos y progreso.");
  await db().end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
