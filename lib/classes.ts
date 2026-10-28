import { notFound } from "next/navigation";

import type { Teacher } from "./auth";
import {
  buildClassSnapshot,
  classReleaseHash,
  extraLabel,
  parseExtraPayload,
  type ClassReleaseSnapshot,
  type ExtraPayload,
  type ExtraType,
} from "./content/classes";
import { db } from "./db";

export type Classroom = {
  id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  teacher_name: string;
  created_at: Date;
};

export type ClassListItem = Classroom & {
  student_count: number;
  extra_count: number;
  published_version: number | null;
  published_at: Date | null;
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
           t.name as teacher_name,
           (select count(*)::int
              from class_members m
             where m.class_id = c.id) as student_count,
           (select count(*)::int
              from extra_classes ec
             where ec.class_id = c.id) as extra_count,
           r.version as published_version,
           r.published_at
      from classes c
      join teachers t on t.id = c.teacher_id
      left join lateral (
        select version, published_at
          from class_releases
         where class_id = c.id
         order by version desc
         limit 1
      ) r on true
     where c.teacher_id = ${teacher.id} or ${teacher.role} = 'admin'
     order by c.created_at desc`;
}

export async function listEditableClasses(teacher: Teacher): Promise<Classroom[]> {
  return db()<Classroom[]>`
    select c.id, c.teacher_id, c.name, c.join_code, c.created_at,
           t.name as teacher_name
      from classes c
      join teachers t on t.id = c.teacher_id
     where c.teacher_id = ${teacher.id} or ${teacher.role} = 'admin'
     order by c.name`;
}

export async function getClassForRead(teacher: Teacher, id: string): Promise<Classroom> {
  const rows = await db()<Classroom[]>`
    select c.id, c.teacher_id, c.name, c.join_code, c.created_at,
           t.name as teacher_name
      from classes c
      join teachers t on t.id = c.teacher_id
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
     where m.class_id = ${classId}
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
           r.version as published_version,
           r.content_hash as published_hash,
           r.published_at
      from classes c
      join teachers t on t.id = c.teacher_id
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
  const klass = await getClassPreviewByCode(code);
  if (!klass) return null;

  await db().begin(async (tx) => {
    const [student] = await tx<{ id: string }[]>`
      insert into students (external_key, name)
      values (${studentKey}, ${studentName})
      on conflict (external_key) do update
        set name = excluded.name, updated_at = now()
      returning id`;

    await tx`
      insert into class_members (class_id, student_id)
      values (${klass.id}, ${student.id})
      on conflict (class_id, student_id) do nothing`;
  });

  return klass;
}

export async function leaveClassByCode(code: string, studentKey: string): Promise<void> {
  await db()`
    delete from class_members
     where class_id = (select id from classes where join_code = ${code})
       and student_id = (select id from students where external_key = ${studentKey})`;
}

export type PublishClassOutcome = {
  version: number;
  hash: string;
  extras: number;
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
      { id: string; name: string; teacher_id: string; teacher_name: string }[]
    >`
      select c.id, c.name, c.teacher_id, t.name as teacher_name
        from classes c
        join teachers t on t.id = c.teacher_id
       where c.id = ${classId}
       for update of c`;
    if (!klass) throw new Error("La clase no existe.");
    if (teacher.role !== "admin" && klass.teacher_id !== teacher.id) {
      throw new Error("No puedes publicar esta clase.");
    }

    const rows = await tx<
      {
        id: string;
        type: ExtraType;
        payload: ExtraPayload;
        lesson_content_id: string;
        lesson_code: string;
        lesson_position: number;
      }[]
    >`
      select e.id, e.type, e.payload,
             l.content_id as lesson_content_id,
             l.code as lesson_code,
             l.position as lesson_position
        from lesson_extras e
        join extra_classes ec on ec.extra_id = e.id and ec.class_id = ${classId}
        join lessons l on l.id = e.lesson_id
        join courses c on c.id = l.course_id and c.is_base
       where l.archived_at is null
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

    return { version, hash: snapshot.hash, extras: rows.length };
  });
}

export function extraSummary(extra: ClassExtra): string {
  return extraLabel(extra.type, extra.payload);
}
