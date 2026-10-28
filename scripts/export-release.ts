/**
 * Exporta el último release de un curso para usarlo como fixture en MLO.
 *
 *   npm run export:release -- base <ruta>/panelRelease.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { db } from "../lib/db";

type Snapshot = {
  manifest: unknown;
  lessons: Record<string, unknown>;
};

async function main() {
  const [catalogId, target] = process.argv.slice(2);
  if (!catalogId || !target) {
    console.error("Uso: npm run export:release -- <catalogId> <ruta.json>");
    process.exit(1);
  }

  const [release] = await db()<{ snapshot: Snapshot }[]>`
    select r.snapshot
      from releases r
      join courses c on c.id = r.course_id
     where c.key = ${catalogId}
     order by r.version desc
     limit 1`;

  if (!release) {
    console.error(`El curso ${catalogId} no tiene ningún release publicado.`);
    process.exit(1);
  }

  const output = {
    manifest: release.snapshot.manifest,
    lessons: Object.values(release.snapshot.lessons),
  };

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Exportado ${catalogId}: ${output.lessons.length} lecciones → ${target}`,
  );
  await db().end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(error);
  await db()
    .end({ timeout: 5 })
    .catch(() => {});
  process.exit(1);
});
