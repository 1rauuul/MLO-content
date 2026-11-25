/**
 * Importa el contenido base exportado por MLO (`scripts/export-base.ts`).
 * Es idempotente: reemplaza el contenido del curso `base`, conserva los
 * snapshots previos y publica una versión nueva para los cursos dependientes.
 * Los ids de unidades, temas y lecciones se conservan para no borrar el
 * contenido extra de los docentes.
 *
 *   npm run import:base [ruta]
 */
import { readFileSync } from "node:fs";

import type { Course } from "../lib/access";
import type { Teacher } from "../lib/auth";
import { db } from "../lib/db";
import type { CoreCourse } from "../lib/content/model";
import { publishCourse } from "../lib/content/publish";
import { applyCourseContent } from "../lib/import-base";

async function main() {
  const file = process.argv[2] ?? "scripts/fixtures/base-course.json";
  const data = JSON.parse(readFileSync(file, "utf8")) as CoreCourse;

  const sql = db();
  await sql.begin(async (tx) => {
    const [course] = await tx<{ id: string }[]>`
      insert into courses (key, title, is_base, uses_base, status)
      values ('base', ${data.title}, true, false, 'published')
      on conflict (key) do update
        set title = excluded.title,
            uses_base = false,
            status = 'published'
      returning id`;

    await applyCourseContent(tx, course.id, data);
  });

  const [publisher] = await sql<Teacher[]>`
    select id, name, email, role
      from teachers
     where role = 'admin'
     order by created_at
     limit 1`;
  if (!publisher) {
    throw new Error("Se necesita una cuenta administradora para publicar el contenido base.");
  }

  const [course] = await sql<Course[]>`
    select id, key, title, description, level, owner_id, is_base, is_group, uses_base, status,
           archived_at
      from courses
     where key = 'base'
     limit 1`;
  if (!course) throw new Error("No se pudo recuperar el curso base importado.");
  const release = await publishCourse(publisher, course);

  console.log(
    `Base importada: ${data.units.length} unidades, ${data.lessons.length} lecciones, ` +
      `${data.evaluations.length} evaluaciones, ${data.exercises.length} ejercicios, ` +
      `${data.examples.length} ejemplos y ${data.questions.length} preguntas. ` +
      `Release v${release.version} publicada.`,
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
