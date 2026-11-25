import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { GET as classPreview } from "@/app/api/mlo/v3/classes/[code]/route";
import { POST as joinClass } from "@/app/api/mlo/v3/classes/[code]/join/route";
import { GET as groupRelease } from "@/app/api/mlo/v3/classes/[code]/release/route";
import { GET as listCourses } from "@/app/api/mlo/v3/courses/route";
import { GET as courseManifest } from "@/app/api/mlo/v3/catalogs/[catalogId]/manifest/route";
import type { Course } from "@/lib/access";
import type { Teacher } from "@/lib/auth";
import { publishClassRelease } from "@/lib/classes";
import type { ReleaseV3 } from "@/lib/content/contract-v3";
import { publishCourse } from "@/lib/content/publish";
import { db } from "@/lib/db";
import { newCourseKey, newJoinCode } from "@/lib/ids";

after(async () => {
  await db().end({ timeout: 5 });
});

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

test("flujo HTTP v3: preview, join, release, cursos y manifest", async () => {
  const baseUrl = "http://localhost/api/mlo/v3";
  const suffix = randomUUID().slice(0, 8);
  const studentKey = randomUUID();
  const studentName = "Alumno E2E";
  const forwardedFor = `e2e-${randomUUID()}`;
  const startedAt = new Date();

  let teacherId: string | null = null;
  let parentCourseId: string | null = null;
  let contentCourseId: string | null = null;
  let classId: string | null = null;

  try {
    const [teacher] = await db()<Teacher[]>`
      insert into teachers (name, email, password_hash, role, activated_at)
      values
        ('Docente E2E', ${`e2e-${randomUUID()}@test.dev`},
         'scrypt$test$test', 'maestro', now())
      returning id, name, email, role`;
    teacherId = teacher.id;

    const courseKey = newCourseKey();
    const [course] = await db()<Course[]>`
      insert into courses
        (key, title, description, level, owner_id, is_base, uses_base, status, is_group)
      values
        (${courseKey}, ${`Curso E2E ${suffix}`}, '', 'Fundamental', ${teacher.id},
         false, false, 'draft', false)
      returning id, key, title, description, level, owner_id, is_base, is_group,
                uses_base, status, archived_at`;
    parentCourseId = course.id;

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

    const lessonContentId = `l-${suffix}`;
    const [lesson] = await db()<{ id: string }[]>`
      insert into lessons (course_id, unit_id, topic_id, content_id, code, title)
      values
        (${course.id}, ${unit.id}, ${topic.id}, ${lessonContentId}, '1.1',
         ${`Lección E2E ${suffix}`})
      returning id`;

    await publishCourse(teacher, course);

    const joinCode = newJoinCode();
    const [klass] = await db()<{ id: string }[]>`
      insert into classes (teacher_id, name, join_code, course_id)
      values
        (${teacher.id}, ${`Grupo E2E ${suffix}`}, ${joinCode}, ${course.id})
      returning id`;
    classId = klass.id;

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
    assert.ok(extra, "falta el extra recién creado");
    await db()`
      insert into extra_classes (extra_id, class_id)
      values (${extra.id}, ${klass.id})`;

    const published = await publishClassRelease(teacher, klass.id);
    assert.equal(published.extras, 1);
    assert.equal(published.v3Version, 1);

    const [stored] = await db()<{ content_course_id: string | null }[]>`
      select content_course_id from classes where id = ${klass.id}`;
    contentCourseId = stored?.content_course_id ?? null;
    assert.ok(contentCourseId, "el grupo debe tener curso de contenido");

    const previewResponse = await classPreview(
      request(`${baseUrl}/classes/${joinCode}`),
      { params: Promise.resolve({ code: joinCode }) },
    );
    assert.equal(previewResponse.status, 200);
    const preview = (await previewResponse.json()) as {
      class: { id: string };
      course: { catalogId: string };
      published: { version: number } | null;
    };
    assert.equal(preview.class.id, klass.id);
    assert.equal(preview.course.catalogId, courseKey);
    assert.equal(preview.published?.version, 1);

    const joinResponse = await joinClass(
      new Request(`${baseUrl}/classes/${joinCode}/join`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": forwardedFor,
        },
        body: JSON.stringify({ studentKey, studentName }),
      }),
      { params: Promise.resolve({ code: joinCode }) },
    );
    assert.equal(joinResponse.status, 200);
    const joined = (await joinResponse.json()) as {
      joined: boolean;
      course: { catalogId: string };
    };
    assert.equal(joined.joined, true);
    assert.equal(joined.course.catalogId, courseKey);

    const releaseResponse = await groupRelease(
      request(`${baseUrl}/classes/${joinCode}/release`, {
        "x-mlo-student-key": studentKey,
      }),
      { params: Promise.resolve({ code: joinCode }) },
    );
    assert.equal(releaseResponse.status, 200);
    const release = (await releaseResponse.json()) as ReleaseV3 & {
      kind: string;
      catalogId: string;
      additions: { lessonId: string; blocks: { type: string; text?: string }[] }[];
    };
    assert.equal(release.kind, "group");
    assert.equal(release.catalogId, courseKey);
    assert.equal(release.additions.length, 1);
    assert.equal(release.additions[0]?.lessonId, `${courseKey}-${lessonContentId}`);
    assert.equal(release.additions[0]?.blocks[0]?.text, "Bloque solo del grupo E2E.");

    const coursesResponse = await listCourses(
      request(`${baseUrl}/courses`, { "x-mlo-student-key": studentKey }),
    );
    assert.equal(coursesResponse.status, 200);
    const courses = (await coursesResponse.json()) as {
      courses: { catalogId: string; version: number }[];
    };
    const listed = courses.courses.find((item) => item.catalogId === courseKey);
    assert.ok(listed, "el curso del grupo debe aparecer en /courses");
    assert.equal(listed.version, 1);

    const manifestResponse = await courseManifest(
      request(`${baseUrl}/catalogs/${courseKey}/manifest`, {
        "x-mlo-student-key": studentKey,
      }),
      { params: Promise.resolve({ catalogId: courseKey }) },
    );
    assert.equal(manifestResponse.status, 200);
    const manifest = (await manifestResponse.json()) as ReleaseV3 & {
      kind: string;
      catalogId: string;
    };
    assert.equal(manifest.kind, "course");
    assert.equal(manifest.catalogId, courseKey);
  } finally {
    if (classId) {
      await db()`delete from classes where id = ${classId}`;
    }
    const courseIds = [parentCourseId, contentCourseId].filter(
      (id): id is string => Boolean(id),
    );
    if (courseIds.length > 0) {
      await db()`delete from lessons where course_id in ${db()(courseIds)}`;
      await db()`delete from topics where course_id in ${db()(courseIds)}`;
      await db()`delete from units where course_id in ${db()(courseIds)}`;
      await db()`delete from courses where id in ${db()(courseIds)}`;
    }
    if (teacherId) {
      await db()`delete from teachers where id = ${teacherId}`;
    }
    await db()`delete from students where external_key = ${studentKey}`;
    await db()`
      delete from auth_rate_limits
       where scope = 'class_join'
         and (key = ${`ip:${forwardedFor}`}
              or (key = 'global' and created_at >= ${startedAt.toISOString()}))`;
  }
});
