import { notFound } from "next/navigation";

import type { Teacher } from "./auth";
import { db } from "./db";

export type Course = {
  id: string;
  key: string;
  title: string;
  owner_id: string | null;
  is_base: boolean;
};

export async function getCourseForRead(teacher: Teacher, id: string): Promise<Course> {
  const rows = await db()<Course[]>`
    select id, key, title, owner_id, is_base
      from courses
     where id = ${id}
     limit 1`;

  const course = rows[0];
  if (!course) notFound();

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
  owner_id: string | null;
  is_base: boolean;
};

/** El admin edita el core; el maestro solo las lecciones de sus cursos. */
export async function requireEditableLesson(
  teacher: Teacher,
  id: string,
): Promise<EditableLesson> {
  const rows = await db()<EditableLesson[]>`
    select l.id, l.code, l.course_id, c.owner_id, c.is_base
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
