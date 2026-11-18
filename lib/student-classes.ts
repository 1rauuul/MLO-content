import { classPreviewPayload, type ClassPreview } from "./classes";
import { db } from "./db";

export type StudentClass = {
  code: string;
  joinedAt: string;
  preview: ReturnType<typeof classPreviewPayload>;
};

/** Membresías activas del alumno para reconstruir su biblioteca en otro equipo. */
export async function listStudentClasses(studentKey: string): Promise<StudentClass[]> {
  const rows = await db()<(ClassPreview & { join_code: string; joined_at: Date })[]>`
    select c.id, c.name, t.name as teacher_name,
           parent.key as course_key, parent.title as course_title,
           r.version as published_version,
           r.content_hash as published_hash,
           r.published_at,
           c.join_code, m.joined_at
      from class_members m
      join students s on s.id = m.student_id
      join classes c on c.id = m.class_id
      join teachers t on t.id = c.teacher_id
      join courses parent on parent.id = c.course_id
      left join lateral (
        select version, content_hash, published_at
          from class_releases
         where class_id = c.id
         order by version desc
         limit 1
      ) r on true
     where s.external_key = ${studentKey}
       and m.active
       and c.archived_at is null
       and parent.archived_at is null
     order by c.name`;

  return rows.map(row => ({
    code: row.join_code,
    joinedAt: row.joined_at.toISOString(),
    preview: classPreviewPayload(row),
  }));
}
