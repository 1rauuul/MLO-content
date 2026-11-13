import { notFound } from "next/navigation";

import type { Teacher } from "./auth";
import { db } from "./db";

export type Course = {
  id: string;
  key: string;
  title: string;
  description: string;
  level: "Fundamental" | "Intermedio" | "Avanzado";
  owner_id: string | null;
  is_base: boolean;
  is_group: boolean;
  uses_base: boolean;
  status: "draft" | "published" | "unpublished";
  archived_at: Date | null;
};

export async function getCourseForRead(teacher: Teacher, id: string): Promise<Course> {
  const rows = await db()<Course[]>`
    select id, key, title, description, level, owner_id, is_base, is_group, uses_base, status,
           archived_at
      from courses
     where id = ${id}
     limit 1`;

  const course = rows[0];
  if (!course) notFound();

  if (course.is_group) {
    const [access] = await db()<{ allowed: boolean }[]>`
      select exists(
        select 1 from classes c
         where c.content_course_id = ${course.id}
           and (c.teacher_id = ${teacher.id} or ${teacher.role} = 'admin')
      ) as allowed`;
    if (!access?.allowed) notFound();
    return course;
  }

  const allowed = course.is_base || course.owner_id === teacher.id || teacher.role === "admin";
  if (!allowed) notFound();

  return course;
}

export function canEditCourse(teacher: Teacher, course: Course): boolean {
  return teacher.role === "admin" || course.owner_id === teacher.id;
}

export async function requireEditableCourse(teacher: Teacher, id: string): Promise<Course> {
  const course = await getCourseForRead(teacher, id);
  if (!canEditCourse(teacher, course)) notFound();
  return course;
}

export type EditableLesson = {
  id: string;
  code: string;
  course_id: string;
  unit_id: string;
  topic_id: string;
  owner_id: string | null;
  is_base: boolean;
};

/** El admin edita el core; el maestro solo las lecciones de sus cursos. */
export async function requireEditableLesson(
  teacher: Teacher,
  id: string,
): Promise<EditableLesson> {
  const rows = await db()<EditableLesson[]>`
    select l.id, l.code, l.course_id, l.unit_id, l.topic_id, c.owner_id, c.is_base
      from lessons l
      join courses c on c.id = l.course_id
     where l.id = ${id}
     limit 1`;

  const lesson = rows[0];
  if (!lesson) notFound();

  const allowed =
    teacher.role === "admin" || (!lesson.is_base && lesson.owner_id === teacher.id);
  if (!allowed) notFound();

  return lesson;
}

export async function getBaseCourseId(): Promise<string | null> {
  const rows = await db()<{ id: string }[]>`select id from courses where is_base limit 1`;
  return rows[0]?.id ?? null;
}

/**
 * Cursos cuyos subtemas puede usar un curso al crear contenido. Un curso de
 * grupo puede adjuntar actividades a los subtemas del curso de su grupo.
 */
export async function topicScopeForCourse(course: Course): Promise<string[]> {
  const baseId = await getBaseCourseId();
  if (!course.is_group) {
    return course.uses_base && baseId ? [baseId, course.id] : [course.id];
  }

  const [parent] = await db()<{ course_id: string; uses_base: boolean }[]>`
    select c.course_id, p.uses_base
      from classes c
      join courses p on p.id = c.course_id
     where c.content_course_id = ${course.id}
       and c.archived_at is null
     limit 1`;
  if (!parent) return [course.id];

  return [
    ...new Set([
      course.id,
      parent.course_id,
      ...(parent.uses_base && baseId ? [baseId] : []),
    ]),
  ];
}

export type ContentTarget = {
  course: Course;
  topicId: string;
  unitId: string;
  unitNumber: number;
};

/** Cursos propios de los grupos seleccionados que el docente puede editar. */
export async function contentCourseTargets(
  teacher: Teacher,
  classIds: string[],
): Promise<Array<{ classId: string; courseId: string }>> {
  const unique = [...new Set(classIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await db()<{
    id: string;
    teacher_id: string;
    content_course_id: string | null;
    archived_at: Date | null;
  }[]>`
    select id, teacher_id, content_course_id, archived_at
      from classes
     where id in ${db()(unique)}`;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return unique
    .map((id) => byId.get(id))
    .filter(
      (row): row is NonNullable<typeof row> =>
        Boolean(
          row &&
            !row.archived_at &&
            row.content_course_id &&
            (teacher.role === "admin" || row.teacher_id === teacher.id),
        ),
    )
    .map((row) => ({ classId: row.id, courseId: row.content_course_id! }));
}

/**
 * Valida el subtema para cada grupo destino antes de crear contenido. Con
 * `classIds` usa el curso propio de cada grupo; sin ellos, el curso indicado.
 */
export async function resolveContentTargets(
  teacher: Teacher,
  classIds: string[],
  fallbackCourseId: string,
  topicId: string,
): Promise<ContentTarget[] | { error: string }> {
  const courseIds = classIds.length
    ? (await contentCourseTargets(teacher, classIds)).map((target) => target.courseId)
    : fallbackCourseId
      ? [fallbackCourseId]
      : [];
  const unique = [...new Set(courseIds)];
  if (unique.length === 0) {
    return { error: "Selecciona al menos un grupo con curso de contenido." };
  }

  const targets: ContentTarget[] = [];
  for (const courseId of unique) {
    const course = await requireEditableCourse(teacher, courseId);
    const scope = await topicScopeForCourse(course);
    const [topic] = await db()<{ id: string; unit_id: string; unit_number: number }[]>`
      select t.id, t.unit_id, u.number as unit_number
        from topics t
        join units u on u.id = t.unit_id
       where t.id = ${topicId}
         and t.course_id in ${db()(scope)}
         and t.archived_at is null
         and u.archived_at is null
       limit 1`;
    if (!topic) {
      return { error: "El subtema no existe en uno de los grupos seleccionados." };
    }
    targets.push({
      course,
      topicId: topic.id,
      unitId: topic.unit_id,
      unitNumber: topic.unit_number,
    });
  }
  return targets;
}
