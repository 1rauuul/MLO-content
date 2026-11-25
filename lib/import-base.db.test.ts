import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { after } from "node:test";

import type { CoreCourse } from "./content/model";
import { db } from "./db";
import { applyCourseContent } from "./import-base";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "scripts/fixtures/base-course.json"), "utf8"),
) as CoreCourse;

after(async () => {
  await db().end({ timeout: 5 });
});

test("reimportar el base conserva extras e ids de unidades, temas y lecciones", async () => {
  await assert.rejects(
    db().begin(async (tx) => {
      const [course] = await tx<{ id: string }[]>`
        select id from courses where key = 'base' limit 1`;
      assert.ok(course, "falta el curso base; ejecuta npm run import:base");

      const [lesson] = await tx<{ id: string }[]>`
        select id from lessons
         where course_id = ${course.id}
         order by position, content_id
         limit 1`;
      assert.ok(lesson, "el curso base no tiene lecciones");

      const [teacher] = await tx<{ id: string }[]>`
        insert into teachers (name, email, password_hash, role, activated_at)
        values
          ('Import base test', ${`import-base-${randomUUID()}@test.dev`},
           'scrypt$test$test', 'maestro', now())
        returning id`;
      const [extra] = await tx<{ id: string }[]>`
        insert into lesson_extras (teacher_id, lesson_id, type, payload)
        values (${teacher.id}, ${lesson.id}, 'lesson', ${tx.json({ prueba: true })})
        returning id`;

      const unitsBefore = await tx<{ id: string }[]>`
        select id from units where course_id = ${course.id} order by content_id`;
      const topicsBefore = await tx<{ id: string }[]>`
        select id from topics where course_id = ${course.id} order by content_id`;
      const lessonsBefore = await tx<{ id: string }[]>`
        select id from lessons where course_id = ${course.id} order by content_id`;

      await applyCourseContent(tx, course.id, fixture);

      const [kept] = await tx<{ id: string }[]>`
        select id from lesson_extras where id = ${extra.id}`;
      assert.ok(kept, "lesson_extras debe conservarse al reimportar el base");

      const unitsAfter = await tx<{ id: string }[]>`
        select id from units where course_id = ${course.id} order by content_id`;
      const topicsAfter = await tx<{ id: string }[]>`
        select id from topics where course_id = ${course.id} order by content_id`;
      const lessonsAfter = await tx<{ id: string }[]>`
        select id from lessons where course_id = ${course.id} order by content_id`;
      assert.deepEqual(unitsAfter, unitsBefore, "las unidades deben conservar sus ids");
      assert.deepEqual(topicsAfter, topicsBefore, "los temas deben conservar sus ids");
      assert.deepEqual(lessonsAfter, lessonsBefore, "las lecciones deben conservar sus ids");

      throw new Error("rollback de la prueba");
    }),
    { message: "rollback de la prueba" },
  );
});
