import { notFound } from "next/navigation";

import type { Teacher } from "./auth";
import type { ContentBlock } from "./content";
import {
  buildClassSnapshot,
  classReleaseHash,
  extraLabel,
  parseExtraPayload,
  type ClassReleaseSnapshot,
  type ExtraPayload,
  type ExtraType,
} from "./content/classes";
import { canJoinGroup, groupVisibility, buildGroupRelease } from "./content/group-release";
import { isUniqueViolation } from "./content/x03";
import { validateRelease } from "./content/contract-v3";
import { validateCatalogForPublish } from "./content/validate";
import type {
  CoreCourse,
  CoreEvaluation,
  CoreExample,
  CoreExercise,
  CoreLesson,
  CoreQuestion,
  CoreReference,
  CoreTopic,
  CoreUnit,
} from "./content/model";
import { db } from "./db";
import { newCourseKey } from "./ids";

export type Classroom = {
  id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  teacher_name: string;
  created_at: Date;
  course_id: string;
  course_title: string;
  content_course_id: string | null;
  capacity: number | null;
  archived_at: Date | null;
};

export type ClassListItem = Classroom & {
  student_count: number;
  extra_count: number;
  published_version: number | null;
  published_at: Date | null;
  v3_version: number | null;
};

export type ClassReleaseInfo = {
  version: number;
  content_hash: string;
  published_at: Date;
};

export type ClassStudent = {
  id: string;
  name: string;
  joined_at: Date;
};

export type ClassExtra = {
  id: string;
  type: ExtraType;
  payload: ExtraPayload;
  lesson_id: string;
  lesson_content_id: string;
  lesson_code: string;
  lesson_title: string;
  lesson_position: number;
  class_names: string[];
  class_ids: string[];
  updated_at: Date;
};

export type BaseLesson = {
  id: string;
  content_id: string;
  code: string;
  title: string;
  unit_number: number;
  unit_title: string;
};

export type ClassPreview = {
  id: string;
  name: string;
  teacher_name: string;
  course_key: string;
  course_title: string;
  published_version: number | null;
  published_hash: string | null;
  published_at: Date | null;
};

export function normalizeJoinCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Respuesta pública de una clase (vista previa y después de unirse). */
export function classPreviewPayload(preview: ClassPreview) {
  return {
    schemaVersion: 2,
    class: {
      id: preview.id,
      name: preview.name,
      teacherName: preview.teacher_name,
    },
    course: {
      catalogId: preview.course_key,
      title: preview.course_title,
    },
    published:
      preview.published_version === null
        ? null
        : {
            version: preview.published_version,
            hash: preview.published_hash,
            publishedAt: new Date(preview.published_at ?? Date.now()).toISOString(),
          },
  };
}

export function isStudentKey(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function canEditClass(teacher: Teacher, klass: Classroom): boolean {
  return teacher.role === "admin" || klass.teacher_id === teacher.id;
}

export async function listClasses(teacher: Teacher): Promise<ClassListItem[]> {
  return db()<ClassListItem[]>`
    select c.id, c.teacher_id, c.name, c.join_code, c.created_at,
           c.course_id, c.content_course_id, c.capacity, c.archived_at,
           t.name as teacher_name, parent.title as course_title,
           (select count(*)::int
              from class_members m
             where m.class_id = c.id and m.active) as student_count,
           (select count(*)::int
              from extra_classes ec
             where ec.class_id = c.id) as extra_count,
           r.version as published_version,
           r.published_at,
           v3.version as v3_version
      from classes c
      join teachers t on t.id = c.teacher_id
      join courses parent on parent.id = c.course_id
      left join lateral (
        select version, published_at
          from class_releases
         where class_id = c.id
         order by version desc
         limit 1
      ) r on true
      left join lateral (
        select version
          from class_releases_v3
         where class_id = c.id
         order by version desc
         limit 1
      ) v3 on true
     where c.teacher_id = ${teacher.id} or ${teacher.role} = 'admin'
     order by c.created_at desc`;
}

export async function listEditableClasses(teacher: Teacher): Promise<Classroom[]> {
  return db()<Classroom[]>`
    select c.id, c.teacher_id, c.name, c.join_code, c.created_at,
           c.course_id, c.content_course_id, c.capacity, c.archived_at,
           t.name as teacher_name, parent.title as course_title
      from classes c
      join teachers t on t.id = c.teacher_id
      join courses parent on parent.id = c.course_id
     where c.teacher_id = ${teacher.id} or ${teacher.role} = 'admin'
     order by c.name`;
}

export async function getClassForRead(teacher: Teacher, id: string): Promise<Classroom> {
  const rows = await db()<Classroom[]>`
    select c.id, c.teacher_id, c.name, c.join_code, c.created_at,
           c.course_id, c.content_course_id, c.capacity, c.archived_at,
           t.name as teacher_name, parent.title as course_title
      from classes c
      join teachers t on t.id = c.teacher_id
      join courses parent on parent.id = c.course_id
     where c.id = ${id}
     limit 1`;
  const klass = rows[0];
  if (!klass) notFound();
  if (!canEditClass(teacher, klass)) notFound();
  return klass;
}

export async function requireEditableClass(teacher: Teacher, id: string): Promise<Classroom> {
  const klass = await getClassForRead(teacher, id);
  if (!canEditClass(teacher, klass)) notFound();
  return klass;
}

export async function getLatestClassRelease(classId: string): Promise<ClassReleaseInfo | null> {
  const rows = await db()<ClassReleaseInfo[]>`
    select version, content_hash, published_at
      from class_releases
     where class_id = ${classId}
     order by version desc
     limit 1`;
  return rows[0] ?? null;
}

export async function getLatestClassSnapshot(
  classId: string,
): Promise<ClassReleaseSnapshot | null> {
  const rows = await db()<{ snapshot: ClassReleaseSnapshot }[]>`
    select snapshot
      from class_releases
     where class_id = ${classId}
     order by version desc
     limit 1`;
  return rows[0]?.snapshot ?? null;
}

export async function listClassStudents(classId: string): Promise<ClassStudent[]> {
  return db()<ClassStudent[]>`
    select s.id, s.name, m.joined_at
      from class_members m
      join students s on s.id = m.student_id
     where m.class_id = ${classId} and m.active
     order by s.name, m.joined_at`;
}

export async function listClassExtras(classId: string): Promise<ClassExtra[]> {
  return db()<ClassExtra[]>`
    select e.id, e.type, e.payload, e.lesson_id, e.updated_at,
           l.content_id as lesson_content_id,
           l.code as lesson_code,
           l.title as lesson_title,
           l.position as lesson_position,
           coalesce(
             (select array_agg(cl.name order by cl.name)
                from extra_classes ec
                join classes cl on cl.id = ec.class_id
               where ec.extra_id = e.id),
             '{}'
           ) as class_names,
           coalesce(
             (select array_agg(ec.class_id order by ec.class_id)
                from extra_classes ec
               where ec.extra_id = e.id),
             '{}'
           ) as class_ids
      from lesson_extras e
      join extra_classes own on own.extra_id = e.id and own.class_id = ${classId}
      join lessons l on l.id = e.lesson_id
      join courses c on c.id = l.course_id and c.is_base
     where l.archived_at is null
     order by l.position, e.updated_at`;
}

export async function listTeacherExtras(teacher: Teacher): Promise<ClassExtra[]> {
  return db()<ClassExtra[]>`
    select e.id, e.type, e.payload, e.lesson_id, e.updated_at,
           l.content_id as lesson_content_id,
           l.code as lesson_code,
           l.title as lesson_title,
           l.position as lesson_position,
           coalesce(
             (select array_agg(cl.name order by cl.name)
                from extra_classes ec
                join classes cl on cl.id = ec.class_id
               where ec.extra_id = e.id),
             '{}'
           ) as class_names,
           coalesce(
             (select array_agg(ec.class_id order by ec.class_id)
                from extra_classes ec
               where ec.extra_id = e.id),
             '{}'
           ) as class_ids
      from lesson_extras e
      join lessons l on l.id = e.lesson_id
      join courses c on c.id = l.course_id and c.is_base
     where l.archived_at is null
       and (e.teacher_id = ${teacher.id} or ${teacher.role} = 'admin')
     order by l.position, e.updated_at desc`;
}

export async function getExtraForRead(teacher: Teacher, id: string): Promise<ClassExtra | null> {
  const rows = await db()<ClassExtra[]>`
    select e.id, e.type, e.payload, e.lesson_id, e.updated_at,
           l.content_id as lesson_content_id,
           l.code as lesson_code,
           l.title as lesson_title,
           l.position as lesson_position,
           coalesce(
             (select array_agg(cl.name order by cl.name)
                from extra_classes ec
                join classes cl on cl.id = ec.class_id
               where ec.extra_id = e.id),
             '{}'
           ) as class_names,
           coalesce(
             (select array_agg(ec.class_id order by ec.class_id)
                from extra_classes ec
               where ec.extra_id = e.id),
             '{}'
           ) as class_ids
      from lesson_extras e
      join lessons l on l.id = e.lesson_id
     where e.id = ${id}
       and (e.teacher_id = ${teacher.id} or ${teacher.role} = 'admin')
     limit 1`;
  return rows[0] ?? null;
}

export async function listBaseLessons(): Promise<BaseLesson[]> {
  return db()<BaseLesson[]>`
    select l.id, l.content_id, l.code, l.title,
           u.number as unit_number, u.title as unit_title
      from lessons l
      join units u on u.id = l.unit_id
      join courses c on c.id = l.course_id
     where c.is_base and l.archived_at is null
     order by u.number, l.position, l.code`;
}

export async function getClassPreviewByCode(code: string): Promise<ClassPreview | null> {
  const rows = await db()<ClassPreview[]>`
    select c.id, c.name, t.name as teacher_name,
           parent.key as course_key, parent.title as course_title,
           r.version as published_version,
           r.content_hash as published_hash,
           r.published_at
      from classes c
      join teachers t on t.id = c.teacher_id
      join courses parent on parent.id = c.course_id
      left join lateral (
        select version, content_hash, published_at
          from class_releases
         where class_id = c.id
         order by version desc
         limit 1
      ) r on true
     where c.join_code = ${code}
     limit 1`;
  return rows[0] ?? null;
}

export async function getClassSnapshotByCode(
  code: string,
): Promise<ClassReleaseSnapshot | null> {
  const rows = await db()<{ snapshot: ClassReleaseSnapshot }[]>`
    select r.snapshot
      from class_releases r
      join classes c on c.id = r.class_id
     where c.join_code = ${code}
     order by r.version desc
     limit 1`;
  return rows[0]?.snapshot ?? null;
}

export async function joinClassByCode(
  code: string,
  studentKey: string,
  studentName: string,
): Promise<ClassPreview | null> {
  const accepted = await (async () => {
    try {
      return await db().begin(async (tx) => {
    const [klass] = await tx<
      { id: string; course_id: string; capacity: number | null; archived_at: Date | null }[]
    >`
      select id, course_id, capacity, archived_at
        from classes
       where join_code = ${code}
       for update`;
    if (!klass || klass.archived_at) return false;

    const [student] = await tx<{ id: string }[]>`
      insert into students (external_key, name)
      values (${studentKey}, ${studentName})
      on conflict (external_key) do update
        set name = excluded.name, updated_at = now()
      returning id`;

    const [current] = await tx<{ active: boolean }[]>`
      select active from class_members
       where class_id = ${klass.id} and student_id = ${student.id}
       limit 1`;
    if (current?.active) return true;

    const [count] = await tx<{ active: number }[]>`
      select count(*)::int as active from class_members
       where class_id = ${klass.id} and active`;
    const duplicate = await tx<{ exists: boolean }[]>`
      select exists(
        select 1
          from class_members m
          join classes c on c.id = m.class_id
         where m.student_id = ${student.id}
           and m.active
           and c.course_id = ${klass.course_id}
           and m.class_id <> ${klass.id}
      ) as exists`;

    const check = canJoinGroup({
      archived: Boolean(klass.archived_at),
      capacity: klass.capacity,
      activeMembers: count.active,
      hasActiveMembershipInCourse: duplicate[0]?.exists ?? false,
    });
    if (!check.ok) return false;

    await tx`
      insert into class_members (class_id, student_id, course_id, active)
      values (${klass.id}, ${student.id}, ${klass.course_id}, true)
      on conflict (class_id, student_id) do update
        set active = true,
            course_id = excluded.course_id,
            joined_at = now()`;

    // La clase concede acceso a su propio curso (el contenido se descarga con
    // su manifest v3) y conserva el acceso al base empaquetado.
    await tx`
      insert into course_access (course_id, student_id)
      values (${klass.course_id}, ${student.id})
      on conflict (course_id, student_id) do nothing`;
    const [base] = await tx<{ id: string }[]>`
      select id from courses where is_base limit 1`;
    if (base) {
      await tx`
        insert into course_access (course_id, student_id)
        values (${base.id}, ${student.id})
        on conflict (course_id, student_id) do nothing`;
    }
    return true;
      });
    } catch (error) {
      // Carrera entre dos joins del mismo curso: el índice único gana; se
      // devuelve rechazo controlado y la transacción ya revirtió.
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  })();

  if (!accepted) return null;
  return getClassPreviewByCode(code);
}

export async function leaveClassByCode(code: string, studentKey: string): Promise<void> {
  await db()`
    update class_members
       set active = false
     where class_id = (select id from classes where join_code = ${code})
       and student_id = (select id from students where external_key = ${studentKey})`;
}

export type PublishClassOutcome = {
  version: number;
  hash: string;
  extras: number;
  v3Version: number;
  v3Hash: string;
};

export function draftClassHash(klass: Classroom, extras: ClassExtra[]): string {
  return classReleaseHash(
    { id: klass.id, name: klass.name, teacherName: klass.teacher_name },
    extras.map((extra) => ({
      id: extra.id,
      type: extra.type,
      payload: extra.payload,
      lesson_content_id: extra.lesson_content_id,
      lesson_code: extra.lesson_code,
      lesson_position: extra.lesson_position,
    })),
  );
}

export async function publishClassRelease(
  teacher: Teacher,
  classId: string,
): Promise<PublishClassOutcome> {
  return db().begin(async (tx) => {
    const [klass] = await tx<
      {
        id: string;
        name: string;
        teacher_id: string;
        teacher_name: string;
        course_id: string;
        content_course_id: string | null;
        archived_at: Date | null;
      }[]
    >`
      select c.id, c.name, c.teacher_id, t.name as teacher_name,
             c.course_id, c.content_course_id, c.archived_at
        from classes c
        join teachers t on t.id = c.teacher_id
       where c.id = ${classId}
       for update of c`;
    if (!klass) throw new Error("El grupo no existe.");
    if (klass.archived_at) throw new Error("Restaura el grupo antes de publicar.");
    if (teacher.role !== "admin" && klass.teacher_id !== teacher.id) {
      throw new Error("No puedes publicar este grupo.");
    }

    const [parent] = await tx<{ key: string; uses_base: boolean }[]>`
      select key, uses_base from courses where id = ${klass.course_id} limit 1`;
    if (!parent) throw new Error("El curso padre del grupo no existe.");
    const [parentRelease] = await tx<{ version: number; hash: string }[]>`
      select version, content_hash as hash
        from releases_v3
       where course_id = ${klass.course_id}
       order by version desc
       limit 1`;
    if (!parentRelease) {
      throw new Error("El curso padre no tiene un release v3 publicado.");
    }

    let contentCourseId = klass.content_course_id;
    if (!contentCourseId) {
      const [created] = await tx<{ id: string }[]>`
        insert into courses
          (key, title, owner_id, is_base, uses_base, status, is_group)
        values
          (${newCourseKey()}, ${`${klass.name} · contenido`}, ${klass.teacher_id},
           false, false, 'draft', true)
        returning id`;
      contentCourseId = created.id;
      await tx`update classes set content_course_id = ${created.id} where id = ${klass.id}`;
    }

    const rows = await tx<
      {
        id: string;
        type: ExtraType;
        payload: ExtraPayload;
        lesson_content_id: string;
        lesson_code: string;
        lesson_position: number;
        lesson_topic_content_id: string;
      }[]
    >`
      select e.id, e.type, e.payload,
             l.content_id as lesson_content_id,
             l.code as lesson_code,
             l.position as lesson_position,
             t.content_id as lesson_topic_content_id
        from lesson_extras e
        join extra_classes ec on ec.extra_id = e.id and ec.class_id = ${classId}
        join lessons l on l.id = e.lesson_id
        join topics t on t.id = l.topic_id
       where l.course_id = ${klass.course_id}
         and l.archived_at is null
       order by l.position, e.id`;

    for (const extra of rows) {
      const parsed = parseExtraPayload(extra.type, extra.payload, { strict: true });
      if ("error" in parsed) {
        throw new Error(`Contenido ${extra.id}: ${parsed.error}`);
      }
    }

    const [next] = await tx<{ version: number }[]>`
      select coalesce(max(version), 0) + 1 as version
        from class_releases
       where class_id = ${classId}`;
    const version = next.version;
    const publishedAt = new Date().toISOString();
    const snapshot = buildClassSnapshot({
      class: {
        id: klass.id,
        name: klass.name,
        teacherName: klass.teacher_name,
      },
      version,
      publishedAt,
      extras: rows,
    });

    await tx`
      insert into class_releases
        (class_id, version, schema_version, content_hash, published_at, published_by, snapshot)
      values
        (${classId}, ${version}, 2, ${snapshot.hash}, ${publishedAt}, ${teacher.id},
         ${tx.json(snapshot as never)})`;

    const units = await tx<CoreUnit[]>`
      select content_id, number, title, description, difficulty, color, position
        from units
       where course_id = ${contentCourseId} and archived_at is null
       order by number, position, content_id`;
    const topics = await tx<(CoreTopic & { id: string; unit_id: string })[]>`
      select id, content_id, unit_id, title, summary, position
        from topics
       where course_id = ${contentCourseId} and archived_at is null
       order by position, content_id`;
    const lessons = await tx<(CoreLesson & { unit_id: string; topic_id: string })[]>`
      select content_id, unit_id, topic_id, code, title, eyebrow, body, code_sample,
             context_title, context_body, synthesis, content, position
        from lessons
       where course_id = ${contentCourseId} and archived_at is null
       order by position, code, content_id`;
    const exercises = await tx<(CoreExercise & { lesson_id: string; topic_id: string })[]>`
      select content_id, lesson_id, topic_id, type, prompt, instructions,
             correct_order, config, explanation, example, position
        from exercises
       where course_id = ${contentCourseId} and archived_at is null
       order by position, content_id`;
    const examples = await tx<(CoreExample & { lesson_id: string; topic_id: string })[]>`
      select content_id, lesson_id, topic_id, type, title, prompt, config, steps,
             hints, explanation, position
        from examples
       where course_id = ${contentCourseId} and archived_at is null
       order by position, content_id`;
    const evaluations = await tx<
      (CoreEvaluation & { lesson_id: string; topic_id: string })[]
    >`
      select content_id, lesson_id, topic_id, title, description,
             question_count, exercise_count, position
        from evaluations
       where course_id = ${contentCourseId} and archived_at is null
       order by position, content_id`;
    const questions = await tx<CoreQuestion[]>`
      select q.content_id, e.content_id as evaluation_content_id, q.type, q.prompt,
             q.options, q.answer, q.config, q.explanation, q.position
        from questions q
        join evaluations e on e.id = q.evaluation_id
       where q.course_id = ${contentCourseId}
         and q.archived_at is null
         and e.archived_at is null
       order by e.content_id, q.position, q.content_id`;
    const evaluationExercises = await tx<
      { evaluation_content_id: string; exercise_content_id: string }[]
    >`
      select e.content_id as evaluation_content_id, x.content_id as exercise_content_id
        from evaluation_exercises ee
        join evaluations e on e.id = ee.evaluation_id
        join exercises x on x.id = ee.exercise_id
       where e.course_id = ${contentCourseId} and e.archived_at is null
         and x.archived_at is null
       order by e.content_id, x.position, x.content_id`;
    const references = await tx<CoreReference[]>`
      select content_id, authors, year, title, source, edition, doi, url
        from content_references
       where course_id = ${contentCourseId} and archived_at is null
       order by content_id`;
    const referenceLinks = await tx<
      { kind: string; element_content_id: string; reference_content_id: string }[]
    >`
      select 'lesson' as kind, l.content_id as element_content_id,
             r.content_id as reference_content_id
        from lesson_references lr
        join content_references r on r.id = lr.reference_id
        join lessons l on l.id = lr.lesson_id
       where l.course_id = ${contentCourseId} and l.archived_at is null
         and r.archived_at is null
      union all
      select 'evaluation', e.content_id, r.content_id
        from evaluation_references er
        join content_references r on r.id = er.reference_id
        join evaluations e on e.id = er.evaluation_id
       where e.course_id = ${contentCourseId} and e.archived_at is null
         and r.archived_at is null
      union all
      select 'question', q.content_id, r.content_id
        from question_references qr
        join content_references r on r.id = qr.reference_id
        join questions q on q.id = qr.question_id
        join evaluations e on e.id = q.evaluation_id
       where q.course_id = ${contentCourseId} and q.archived_at is null
         and e.archived_at is null and r.archived_at is null
      union all
      select 'exercise', x.content_id, r.content_id
        from exercise_references xr
        join content_references r on r.id = xr.reference_id
        join exercises x on x.id = xr.exercise_id
       where x.course_id = ${contentCourseId} and x.archived_at is null
         and r.archived_at is null
      union all
      select 'example', x.content_id, r.content_id
        from example_references xr
        join content_references r on r.id = xr.reference_id
        join examples x on x.id = xr.example_id
       where x.course_id = ${contentCourseId} and x.archived_at is null
         and r.archived_at is null
      order by 1, 2, 3`;
    const referenceIdsByElement = new Map<string, string[]>();
    for (const row of referenceLinks) {
      const key = `${row.kind}:${row.element_content_id}`;
      const list = referenceIdsByElement.get(key) ?? [];
      list.push(row.reference_content_id);
      referenceIdsByElement.set(key, list);
    }
    const elementReferences = (kind: string, contentId: string): string[] =>
      referenceIdsByElement.get(`${kind}:${contentId}`) ?? [];

    const unitKey = new Map(
      (
        await tx<{ id: string; content_id: string }[]>`
          select id, content_id from units where course_id = ${contentCourseId}`
      ).map((row) => [row.id, row.content_id]),
    );
    const [base] = await tx<{ id: string }[]>`
      select id from courses where is_base limit 1`;
    const sourceTopicIds = [
      klass.course_id,
      ...(parent.uses_base && base ? [base.id] : []),
    ];
    const sourceTopics = await tx<{ id: string; content_id: string }[]>`
      select id, content_id from topics
       where course_id in ${tx(sourceTopicIds)} and archived_at is null`;
    const topicKey = new Map(
      [...topics, ...sourceTopics].map((row) => [row.id, row.content_id]),
    );
    const lessonKey = new Map(
      (
        await tx<{ id: string; content_id: string }[]>`
          select id, content_id from lessons where course_id = ${contentCourseId}`
      ).map((row) => [row.id, row.content_id]),
    );
    const evalExercises = new Map<string, string[]>();
    for (const row of evaluationExercises) {
      const list = evalExercises.get(row.evaluation_content_id) ?? [];
      list.push(row.exercise_content_id);
      evalExercises.set(row.evaluation_content_id, list);
    }

    const own: CoreCourse = {
      schemaVersion: 2,
      title: klass.name,
      units,
      topics: topics.map((topic) => ({
        content_id: topic.content_id,
        unit_content_id: unitKey.get(topic.unit_id) ?? topic.unit_id,
        title: topic.title,
        summary: topic.summary,
        position: topic.position,
      })),
      lessons: lessons.map((lesson) => ({
        content_id: lesson.content_id,
        unit_content_id: unitKey.get(lesson.unit_id) ?? lesson.unit_id,
        topic_content_id: topicKey.get(lesson.topic_id) ?? lesson.topic_id,
        code: lesson.code,
        title: lesson.title,
        eyebrow: lesson.eyebrow,
        body: lesson.body,
        code_sample: lesson.code_sample,
        context_title: lesson.context_title,
        context_body: lesson.context_body,
        synthesis: lesson.synthesis,
        content: lesson.content,
        position: lesson.position,
        reference_content_ids: elementReferences("lesson", lesson.content_id),
      })),
      exercises: exercises.map((exercise) => ({
        content_id: exercise.content_id,
        lesson_content_id: lessonKey.get(exercise.lesson_id) ?? exercise.lesson_id,
        topic_content_id: topicKey.get(exercise.topic_id) ?? exercise.topic_id,
        type: exercise.type,
        prompt: exercise.prompt,
        instructions: exercise.instructions,
        correct_order: exercise.correct_order,
        config: exercise.config,
        explanation: exercise.explanation,
        example: exercise.example,
        position: exercise.position,
        reference_content_ids: elementReferences("exercise", exercise.content_id),
      })),
      examples: examples.map((example) => ({
        content_id: example.content_id,
        lesson_content_id: lessonKey.get(example.lesson_id) ?? example.lesson_id,
        topic_content_id: topicKey.get(example.topic_id) ?? example.topic_id,
        type: example.type,
        title: example.title,
        prompt: example.prompt,
        config: example.config,
        steps: example.steps,
        hints: example.hints,
        explanation: example.explanation,
        position: example.position,
        reference_content_ids: elementReferences("example", example.content_id),
      })),
      evaluations: evaluations.map((evaluation) => ({
        content_id: evaluation.content_id,
        lesson_content_id: lessonKey.get(evaluation.lesson_id) ?? evaluation.lesson_id,
        topic_content_id: topicKey.get(evaluation.topic_id) ?? evaluation.topic_id,
        title: evaluation.title,
        description: evaluation.description,
        question_count: evaluation.question_count,
        exercise_count: evaluation.exercise_count,
        position: evaluation.position ?? 0,
        exercise_content_ids: evalExercises.get(evaluation.content_id) ?? [],
        reference_content_ids: elementReferences("evaluation", evaluation.content_id),
      })),
      questions: questions.map((question) => ({
        ...question,
        reference_content_ids: elementReferences("question", question.content_id),
      })),
      references,
    };

    const additionsByLesson = new Map<string, ContentBlock[]>();
    const externalExercises: CoreExercise[] = [];
    const externalExamples: CoreExample[] = [];
    let exercisePosition = 0;
    let examplePosition = 0;

    for (const extra of rows) {
      if (extra.type === "lesson") {
        const payload = extra.payload as { blocks: ContentBlock[] };
        const blocks = additionsByLesson.get(extra.lesson_content_id) ?? [];
        additionsByLesson.set(extra.lesson_content_id, [...blocks, ...payload.blocks]);
      } else if (extra.type === "exercise") {
        const payload = extra.payload as {
          type: CoreExercise["type"];
          prompt: string;
          instructions: string;
          correctOrder: string[];
          config: CoreExercise["config"];
          explanation: string;
          example: CoreExercise["example"];
        };
        externalExercises.push({
          content_id: extra.id,
          lesson_content_id: extra.lesson_content_id,
          topic_content_id: extra.lesson_topic_content_id,
          type: payload.type,
          prompt: payload.prompt,
          instructions: payload.instructions,
          correct_order: payload.correctOrder,
          config: payload.config,
          explanation: payload.explanation,
          example: payload.example,
          position: exercisePosition,
        });
        exercisePosition += 1;
      } else {
        const payload = extra.payload as {
          type: CoreExample["type"];
          title: string;
          prompt: string;
          config: CoreExample["config"];
          steps: CoreExample["steps"];
          hints: string[];
          explanation: string;
        };
        externalExamples.push({
          content_id: extra.id,
          lesson_content_id: extra.lesson_content_id,
          topic_content_id: extra.lesson_topic_content_id,
          type: payload.type,
          title: payload.title,
          prompt: payload.prompt,
          config: payload.config,
          steps: payload.steps,
          hints: payload.hints,
          explanation: payload.explanation,
          position: examplePosition,
        });
        examplePosition += 1;
      }
    }

    const [v3Next] = await tx<{ version: number }[]>`
      select coalesce(max(version), 0) + 1 as version
        from class_releases_v3
       where class_id = ${classId}`;
    validateCatalogForPublish(own);
    const release = buildGroupRelease({
      catalogId: parent.key,
      groupId: klass.id,
      contentCourseId,
      version: v3Next.version,
      publishedAt,
      name: klass.name,
      visibility: groupVisibility({ archived: Boolean(klass.archived_at) }),
      courseRef: { version: parentRelease.version, hash: parentRelease.hash },
      own,
      externalTopicContentIds: [
        ...new Set(sourceTopics.map((topic) => topic.content_id)),
      ],
      additions: [...additionsByLesson.entries()].map(([lessonContentId, blocks]) => ({
        lessonContentId,
        blocks,
      })),
      externalExercises,
      externalExamples,
    });
    const checked = validateRelease(release);
    if (!checked.ok) {
      throw new Error(`El release de grupo no es válido: ${checked.error}`);
    }

    await tx`
      insert into class_releases_v3
        (class_id, version, content_hash, published_at, published_by, snapshot)
      values
        (${classId}, ${Number(release.version)}, ${String(release.hash)}, ${publishedAt},
         ${teacher.id}, ${tx.json({ release } as never)})`;

    return {
      version,
      hash: snapshot.hash,
      extras: rows.length,
      v3Version: Number(release.version),
      v3Hash: String(release.hash),
    };
  });
}

export function extraSummary(extra: ClassExtra): string {
  return extraLabel(extra.type, extra.payload);
}
