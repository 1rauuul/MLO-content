import { randomUUID } from "node:crypto";

import type { Course } from "@/lib/access";
import type { Teacher } from "@/lib/auth";
import { publishClassRelease, type PublishClassOutcome } from "@/lib/classes";
import { publishCourse } from "@/lib/content/publish";
import { db } from "@/lib/db";
import { newCourseKey, newJoinCode } from "@/lib/ids";

/**
 * Datos temporales de la E2E de la API v3. Los ids empiezan en `null` para que
 * `cleanupE2EFixture` pueda limpiar una siembra que falló a medias.
 */
export type E2EFixture = {
  classId: string | null;
  parentCourseId: string | null;
  contentCourseId: string | null;
  teacherId: string | null;
  courseKey: string;
  joinCode: string;
  lessonContentId: string;
  published: PublishClassOutcome | null;
  studentKey: string;
  studentName: string;
  forwardedFor: string;
  startedAt: Date;
};

export async function seedE2EFixture(): Promise<E2EFixture> {
  const suffix = randomUUID().slice(0, 8);
  const fixture: E2EFixture = {
    classId: null,
    parentCourseId: null,
    contentCourseId: null,
    teacherId: null,
    courseKey: newCourseKey(),
    joinCode: newJoinCode(),
    lessonContentId: `l-${suffix}`,
    published: null,
    studentKey: randomUUID(),
    studentName: "Alumno E2E",
    forwardedFor: `e2e-${randomUUID()}`,
    startedAt: new Date(),
  };

  try {
    const [teacher] = await db()<Teacher[]>`
      insert into teachers (name, email, password_hash, role, activated_at)
      values
        ('Docente E2E', ${`e2e-${randomUUID()}@test.dev`},
         'scrypt$test$test', 'maestro', now())
      returning id, name, email, role`;
    fixture.teacherId = teacher.id;

    const [course] = await db()<Course[]>`
      insert into courses
        (key, title, description, level, owner_id, is_base, uses_base, status, is_group)
      values
        (${fixture.courseKey}, ${`Curso E2E ${suffix}`}, '', 'Fundamental', ${teacher.id},
         false, false, 'draft', false)
      returning id, key, title, description, level, owner_id, is_base, is_group,
                uses_base, status, archived_at`;
    fixture.parentCourseId = course.id;

    const [unit] = await db()<{ id: string }[]>`
      insert into units (course_id, content_id, number, title, difficulty, color)
      values
        (${course.id}, ${`u-${suffix}`}, 1, ${`Unidad E2E ${suffix}`},
         'Fundamental', 'blue')
      returning id`;

    const [topic] = await db()<{ id: string }[]>`
      insert into topics (course_id, unit_id, content_id, title)
      values (${course.id}, ${unit.id}, ${`t-${suffix}`}, ${`Tema E2E ${suffix}`})
      returning id`;

    const lessonContentId = fixture.lessonContentId;
    const [lesson] = await db()<{ id: string }[]>`
      insert into lessons (course_id, unit_id, topic_id, content_id, code, title)
      values
        (${course.id}, ${unit.id}, ${topic.id}, ${lessonContentId}, '1.1',
         ${`Lección E2E ${suffix}`})
      returning id`;

    await publishCourse(teacher, course);

    const [klass] = await db()<{ id: string }[]>`
      insert into classes (teacher_id, name, join_code, course_id)
      values
        (${teacher.id}, ${`Grupo E2E ${suffix}`}, ${fixture.joinCode}, ${course.id})
      returning id`;
    fixture.classId = klass.id;

    await db()`
      insert into lesson_extras (teacher_id, lesson_id, type, payload)
      values
        (${teacher.id}, ${lesson.id}, 'lesson',
         ${db().json({
           title: "Extra E2E",
           blocks: [{ type: "p", text: "Bloque solo del grupo E2E." }],
         })})`;
    const [extra] = await db()<{ id: string }[]>`
      select id from lesson_extras
       where teacher_id = ${teacher.id} and lesson_id = ${lesson.id}
       order by created_at desc
       limit 1`;
    if (!extra) throw new Error("falta el extra recién creado");
    await db()`
      insert into extra_classes (extra_id, class_id)
      values (${extra.id}, ${klass.id})`;

    fixture.published = await publishClassRelease(teacher, klass.id);

    const [stored] = await db()<{ content_course_id: string | null }[]>`
      select content_course_id from classes where id = ${klass.id}`;
    fixture.contentCourseId = stored?.content_course_id ?? null;
    if (!fixture.contentCourseId) {
      throw new Error("el grupo debe tener curso de contenido");
    }

    return fixture;
  } catch (error) {
    await cleanupE2EFixture(fixture);
    throw error;
  }
}

export async function cleanupE2EFixture(fixture: E2EFixture): Promise<void> {
  if (fixture.classId) {
    await db()`delete from classes where id = ${fixture.classId}`;
  }
  const courseIds = [fixture.parentCourseId, fixture.contentCourseId].filter(
    (id): id is string => Boolean(id),
  );
  if (courseIds.length > 0) {
    await db()`delete from lessons where course_id in ${db()(courseIds)}`;
    await db()`delete from topics where course_id in ${db()(courseIds)}`;
    await db()`delete from units where course_id in ${db()(courseIds)}`;
    await db()`delete from courses where id in ${db()(courseIds)}`;
  }
  if (fixture.teacherId) {
    await db()`delete from teachers where id = ${fixture.teacherId}`;
  }
  await db()`delete from students where external_key = ${fixture.studentKey}`;
  await db()`
    delete from auth_rate_limits
     where scope = 'class_join'
       and (key = ${`ip:${fixture.forwardedFor}`}
            or (key = 'global' and created_at >= ${fixture.startedAt.toISOString()}))`;
}
